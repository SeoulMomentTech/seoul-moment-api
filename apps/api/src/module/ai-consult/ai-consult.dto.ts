import { RedisKey } from '@app/cache/cache.dto';
import { SupportEnv } from '@app/config/enum/config.enum';
import { AiConsultCategoryMatchMeta } from '@app/repository/dto/ai-consult.dto';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import {
  AiConsultAnswerType,
  AiConsultCategoryMatchType,
  AiConsultIntent,
  AiConsultScope,
} from '@app/repository/enum/ai-consult.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { createHash } from 'crypto';

import { AiConsultPrefaceId, FAQ_NONE, findFaqItem } from './ai-consult.faq';
import { findBestSimilarity, toJamo } from './ai-consult.similarity';
import { MultilingualFieldDto } from '../dto/multilingual.dto';

export const AI_CONSULT_MIN_MESSAGE_LENGTH = 2;
export const AI_CONSULT_MAX_MESSAGE_LENGTH = 300;

/** 이 값 이상이면 저장된 FAQ 답변을 그대로 내보낸다. */
export const CONFIDENCE_ANSWER_THRESHOLD = 0.7;
/** 이 값 이상 ANSWER 미만이면 확신이 부족하므로 되묻는다. */
export const CONFIDENCE_CONFIRM_THRESHOLD = 0.45;

export const ANSWER_CACHE_TTL_SECONDS = 60 * 60 * 24;
/** "네", "?" 같은 무의미 입력까지 캐시해 키 공간을 오염시키지 않도록 하한을 둔다. */
export const ANSWER_CACHE_MIN_LENGTH = 6;

export const RATE_LIMIT_PER_USER = 60;
export const RATE_LIMIT_USER_WINDOW_SECONDS = 60 * 60;

/**
 * IP 리밋은 XFF 신뢰 여부에 따라 오작동할 수 있다.
 * 0 으로 두면 비활성화되고, 상한 보장은 일일 예산 카운터가 담당한다.
 */
export const RATE_LIMIT_PER_IP = 20;
export const RATE_LIMIT_IP_WINDOW_SECONDS = 60 * 10;

/**
 * 개인 레이트리밋(유저·IP)을 적용하지 않는 환경.
 *
 * 개발 중에는 같은 IP 로 수십 번 두드리게 되는데 20회/10분에 걸리면 테스트가 막힌다.
 * **전역 일일 예산은 모든 환경에서 그대로 유지**되므로 비용 상한은 여전히 보장된다.
 * test 는 제외하지 않는다 — 통합 테스트가 이 로직을 실제로 검증해야 하기 때문이다.
 */
export const RATE_LIMIT_DISABLED_ENVS: readonly SupportEnv[] = [
  SupportEnv.LOCAL,
  SupportEnv.DEV,
];

/** 전역 일일 LLM 호출 상한. 낮게 시작해 실측 후 상향한다. */
export const DAILY_LLM_CALL_LIMIT = 1500;
/**
 * 25시간. TTL 이 정확히 24시간이면 날짜가 바뀌는 순간 이전 키가 아직 살아있는
 * 구간이 생기지 않아 카운터가 비는 틈이 생길 수 있으므로 한 시간 겹치게 둔다.
 */
export const DAILY_BUDGET_TTL_SECONDS = 90000;

export const MAX_SUGGESTION_COUNT = 3;

/**
 * 모델이 채우는 categoryQuery 의 상한.
 * 조회 키로만 쓰이므로 카테고리명보다 길 이유가 없고, 길이를 열어두면
 * 캐시 JSON 과 로그 meta 가 모델 출력만큼 부풀 수 있다.
 */
export const AI_CONSULT_MAX_CATEGORY_QUERY_LENGTH = 40;

/**
 * 자모 단위 유사도가 이 값 이상이면 오타로 보고 같은 카테고리로 매칭한다.
 * 0.7 은 "악세사리→악세서리"(0.89) 같은 한 글자 오타는 통과시키면서
 * "전자제품→화장품"(0.5) 처럼 아예 다른 이름은 걸러내는 지점이다.
 */
export const CATEGORY_FUZZY_MATCH_THRESHOLD = 0.7;
/**
 * 1·2위 유사도 차이가 이 값 미만이면 매칭하지 않는다.
 * "가방"/"가발"처럼 서로 닮은 카테고리가 둘 다 후보로 남았을 때,
 * 반반 확률로 찍어 엉뚱한 목록을 보여주느니 되묻는 편이 낫다.
 */
export const CATEGORY_FUZZY_MATCH_MARGIN = 0.05;
/**
 * 유사도 매칭을 적용할 이름의 최소 자모 길이(한글 2음절 상당).
 * 짧은 이름은 한 글자만 달라도 유사도가 높게 나와 오탐이 된다.
 */
export const CATEGORY_FUZZY_MIN_NAME_LENGTH = 4;

/**
 * 표기 변형("배송 얼마나 걸려요?" / " 배송  얼마나 걸려요? ")을 한 키로 모은다.
 * 세션이 없어 모든 질문이 자기완결적이므로 문맥 의존 오답 캐시 위험이 없다.
 */
export function buildAnswerCacheKey(
  question: string,
  language: LanguageCode,
): string {
  const normalized = question
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const hash = createHash('sha256')
    .update(`${language}:${normalized}`)
    .digest('hex')
    .slice(0, 32);

  return `${RedisKey.AI_CONSULT_ANSWER}:${language}:${hash}`;
}

/** 전역 일일 예산 카운터 키. UTC 날짜 기준으로 하루를 나눈다. */
export function buildDailyBudgetKey(date = new Date()): string {
  return `${RedisKey.AI_CONSULT_BUDGET}:${date.toISOString().slice(0, 10)}`;
}

export class PostAiConsultAskRequest {
  @ApiProperty({
    description: '고객 질문. 이전 대화를 기억하지 않으므로 자기완결적으로 작성',
    example: '배송 얼마나 걸려요?',
    minLength: AI_CONSULT_MIN_MESSAGE_LENGTH,
    maxLength: AI_CONSULT_MAX_MESSAGE_LENGTH,
  })
  @IsString()
  @Length(AI_CONSULT_MIN_MESSAGE_LENGTH, AI_CONSULT_MAX_MESSAGE_LENGTH)
  message: string;
}

export class AiConsultBrandResponse {
  @ApiProperty({ description: '브랜드 ID', example: 110 })
  id: number;

  @ApiProperty({ description: '브랜드 이름', example: '서울모먼트' })
  name: string;

  @ApiProperty({
    description: '브랜드 프로필 이미지 URL. 없으면 null',
    example: 'https://image-dev.seoulmoment.com.tw/brand/seoul-moment.png',
    nullable: true,
  })
  image: string | null;

  static from(id: number, name: string, image: string | null) {
    return plainToInstance(this, { id, name, image });
  }
}

export class AiConsultCategoryResponse {
  @ApiProperty({ description: '카테고리 ID', example: 2 })
  id: number;

  @ApiProperty({ description: '카테고리 이름', example: '화장품' })
  name: string;

  @ApiProperty({
    description:
      '카테고리 이미지 URL. 대분류에는 이미지가 없어 항상 null 이고, 소분류도 미등록이면 null',
    example: 'https://image-dev.seoulmoment.com.tw/category/cosmetic.png',
    nullable: true,
  })
  image: string | null;

  static from(id: number, name: string, image: string | null) {
    return plainToInstance(this, { id, name, image });
  }
}

/** 카탈로그 입력. 대분류(CategoryEntity)는 이미지 컬럼이 없어 항상 null 이다. */
export interface AiConsultCategorySource {
  id: number;
  image: string | null;
}

/** 유사도 순위 한 칸. 어떤 이름과 몇 점으로 붙었는지까지 들고 다닌다. */
interface AiConsultCategoryCandidate {
  id: number;
  name: string;
  score: number;
}

/**
 * 카테고리 이름 매칭 결과.
 *
 * `number | null` 만 돌려주면 못 찾은 이유가 사라져 로그로 임계값을 조정할 수
 * 없다. 매칭된 id 와 함께 "어느 단계에서, 몇 점으로" 결판났는지를 같이 옮긴다.
 */
export class AiConsultCategoryMatchDto {
  private constructor(
    private readonly id: number | null,
    private readonly type: AiConsultCategoryMatchType,
    private readonly score: number | null,
    private readonly runnerUpScore: number | null,
    private readonly candidate: string | null,
  ) {}

  static exact(id: number, name: string): AiConsultCategoryMatchDto {
    return new AiConsultCategoryMatchDto(
      id,
      AiConsultCategoryMatchType.EXACT,
      null,
      null,
      name,
    );
  }

  static partial(id: number, name: string): AiConsultCategoryMatchDto {
    return new AiConsultCategoryMatchDto(
      id,
      AiConsultCategoryMatchType.PARTIAL,
      null,
      null,
      name,
    );
  }

  static noCandidate(): AiConsultCategoryMatchDto {
    return new AiConsultCategoryMatchDto(
      null,
      AiConsultCategoryMatchType.NO_CANDIDATE,
      null,
      null,
      null,
    );
  }

  static emptyCatalog(): AiConsultCategoryMatchDto {
    return new AiConsultCategoryMatchDto(
      null,
      AiConsultCategoryMatchType.EMPTY_CATALOG,
      null,
      null,
      null,
    );
  }

  /** 임계값·마진 판정을 여기 가둬 호출부가 점수를 직접 비교하지 않게 한다. */
  static fromSimilarity(
    best: AiConsultCategoryCandidate,
    runnerUp: AiConsultCategoryCandidate | null,
  ): AiConsultCategoryMatchDto {
    const runnerUpScore = runnerUp?.score ?? null;
    const build = (
      id: number | null,
      type: AiConsultCategoryMatchType,
    ): AiConsultCategoryMatchDto =>
      new AiConsultCategoryMatchDto(
        id,
        type,
        best.score,
        runnerUpScore,
        best.name,
      );

    if (best.score < CATEGORY_FUZZY_MATCH_THRESHOLD) {
      return build(null, AiConsultCategoryMatchType.BELOW_THRESHOLD);
    }

    if (
      runnerUpScore !== null &&
      best.score - runnerUpScore < CATEGORY_FUZZY_MATCH_MARGIN
    ) {
      return build(null, AiConsultCategoryMatchType.AMBIGUOUS);
    }

    return build(best.id, AiConsultCategoryMatchType.SIMILARITY);
  }

  /** 못 찾았으면 null. 호출부는 이 값으로 FALLBACK 여부를 가른다. */
  getId(): number | null {
    return this.id;
  }

  /** 점수는 로그 가독성을 위해 소수점 3자리로 자른다. */
  toLogMeta(): AiConsultCategoryMatchMeta {
    const round = (value: number | null): number | undefined =>
      value === null ? undefined : Math.round(value * 1000) / 1000;

    return {
      type: this.type,
      score: round(this.score),
      runnerUpScore: round(this.runnerUpScore),
      candidate: this.candidate ?? undefined,
    };
  }
}

/**
 * 표기 차이를 흡수해 이름을 비교 가능한 형태로 만든다.
 * "화장품 " / "화 장 품" / "Cosmetics" 를 한 키로 모은다.
 */
function normalizeCategoryName(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

/**
 * 카테고리 목록 + 이름→ID 색인.
 *
 * 모델이 뱉은 자유 텍스트를 DB 실데이터에 붙이는 유일한 지점이라 매칭 규칙을
 * 한 곳에 가둔다. 색인은 **모든 언어의 이름**으로 만들고 노출용 이름만 요청
 * 언어로 고른다 — Accept-Language 가 en 이어도 고객이 한국어로 물을 수 있다.
 */
export class AiConsultCategoryCatalogDto {
  private constructor(
    private readonly items: AiConsultCategoryResponse[],
    private readonly idByName: ReadonlyMap<string, number>,
  ) {}

  static from(
    sources: readonly AiConsultCategorySource[],
    textList: MultilingualTextEntity[],
    language: LanguageCode,
  ): AiConsultCategoryCatalogDto {
    const items: AiConsultCategoryResponse[] = [];
    const idByName = new Map<string, number>();

    for (const source of sources) {
      const field = MultilingualFieldDto.fromByEntityList(
        textList.filter((text) => text.entityId === source.id),
        'name',
      );
      const name = field.getContentByLanguageWithFallback(language);

      // 이름을 못 찾은 카테고리는 빈 카드가 되므로 목록에서 뺀다.
      if (!name) continue;

      items.push(AiConsultCategoryResponse.from(source.id, name, source.image));

      for (const text of field.texts) {
        idByName.set(normalizeCategoryName(text.content), source.id);
      }
    }

    return new AiConsultCategoryCatalogDto(items, idByName);
  }

  getItems(): AiConsultCategoryResponse[] {
    return this.items;
  }

  getCount(): number {
    return this.items.length;
  }

  findItem(id: number): AiConsultCategoryResponse | null {
    return this.items.find((item) => item.id === id) ?? null;
  }

  /**
   * 완전일치 → 부분일치 → 자모 유사도 순으로 내려간다.
   * 못 찾아도 "어디까지 갔는지"를 담은 결과를 돌려준다 — 호출부가 FALLBACK 을
   * 내면서 그 이유를 로그에 남길 수 있어야 임계값을 근거 있게 조정한다.
   */
  findMatch(query: string): AiConsultCategoryMatchDto {
    const normalized = normalizeCategoryName(query);

    if (!normalized) return AiConsultCategoryMatchDto.noCandidate();

    const exact = this.idByName.get(normalized);

    if (exact !== undefined) {
      return AiConsultCategoryMatchDto.exact(exact, normalized);
    }

    // "화장품은" / "화장품 카테고리" 처럼 조사·수식어가 붙은 경우를 흡수한다.
    // 1글자 이름은 우연히 포함될 확률이 높아 부분일치 대상에서 제외한다.
    for (const [name, id] of this.idByName) {
      if (name.length >= 2 && normalized.includes(name)) {
        return AiConsultCategoryMatchDto.partial(id, name);
      }
    }

    const ranked = this.rankBySimilarity(normalized);

    if (ranked.length === 0) return AiConsultCategoryMatchDto.noCandidate();

    return AiConsultCategoryMatchDto.fromSimilarity(
      ranked[0],
      ranked[1] ?? null,
    );
  }

  /**
   * 마지막 구제 단계.
   *
   * 고객이 "악세사리"라고 써서 실제 이름 "악세서리"와 글자 단위로는 어긋나는
   * 경우까지 잡는다. 표기 흔들림은 고객 잘못이 아닌데 "그런 카테고리 없다"로
   * 되묻는 것은 나쁜 경험이라 여기서 흡수한다.
   */
  private rankBySimilarity(normalized: string): AiConsultCategoryCandidate[] {
    const bestById = new Map<number, AiConsultCategoryCandidate>();

    for (const [name, id] of this.idByName) {
      if (toJamo(name).length < CATEGORY_FUZZY_MIN_NAME_LENGTH) continue;

      const score = findBestSimilarity(normalized, name);
      const current = bestById.get(id);

      // 같은 카테고리의 다국어 이름 중 가장 잘 맞는 하나만 대표로 남긴다.
      if (!current || score > current.score) {
        bestById.set(id, { id, name, score });
      }
    }

    return [...bestById.values()].sort((a, b) => b.score - a.score);
  }
}

/**
 * 서비스 내부 결과.
 *
 * 고객 응답(`PostAiConsultAskResponse`)에는 일부만 나가지만, 로그에는 판정 정보
 * (answerType·faqCode·confidence)가 있어야 튜닝이 가능하다.
 * 그래서 "내부에서 아는 것"과 "밖에 내보내는 것"을 타입으로 분리한다.
 */
export class AiConsultAnswerDto {
  answer: string;
  answerType: AiConsultAnswerType;
  faqCode: string | null;
  confidence: number | null;
  /** 추천 질문 제목. 유저가 칩을 누르면 이 문자열을 그대로 message 로 보내면 된다. */
  suggestions: string[];
  /** BRAND_LIST 응답에서만 채워진다. 값은 전부 DB 에서 재조회한 것이다. */
  brands: AiConsultBrandResponse[] = [];
  /** CATEGORY_LIST(대분류) / PRODUCT_CATEGORY_LIST(소분류) 응답에서만 채워진다. */
  categories: AiConsultCategoryResponse[] = [];
  /** 소분류 응답에서 상위 대분류. 그 외에는 null. */
  parentCategory: AiConsultCategoryResponse | null = null;
  /**
   * 카테고리 이름 매칭 결과. **로그 전용이며 고객 응답에는 나가지 않는다.**
   * 실패한 건에도 채워야 FALLBACK 의 원인을 사후에 가를 수 있다.
   */
  categoryMatch: AiConsultCategoryMatchDto | null = null;

  static from(
    answer: string,
    answerType: AiConsultAnswerType,
    faqCode: string | null,
    confidence: number | null,
    suggestions: string[],
  ): AiConsultAnswerDto {
    const dto = new AiConsultAnswerDto();

    dto.answer = answer;
    dto.answerType = answerType;
    dto.faqCode = faqCode;
    dto.confidence = confidence;
    dto.suggestions = suggestions;

    return dto;
  }

  withBrands(brands: AiConsultBrandResponse[]): this {
    this.brands = brands;

    return this;
  }

  withCategories(
    categories: AiConsultCategoryResponse[],
    parentCategory: AiConsultCategoryResponse | null = null,
  ): this {
    this.categories = categories;
    this.parentCategory = parentCategory;

    return this;
  }

  withCategoryMatch(match: AiConsultCategoryMatchDto): this {
    this.categoryMatch = match;

    return this;
  }
}

export class PostAiConsultAskResponse {
  @ApiProperty({
    description:
      '고객에게 보여줄 답변. 서버 상수에서 그대로 꺼낸 문장이며 AI 가 생성하지 않는다',
    example:
      '결제가 완료되면 영업일 기준 2~4일 내에 출고되고, 출고 후 배송에 2~5일이 더 걸립니다.',
  })
  answer: string;

  @ApiProperty({
    description:
      '답변 종류. 장애·제한 상황도 200 으로 내려가므로 프론트는 이 값으로 구분한다. ' +
      'UNAVAILABLE/RATE_LIMITED 면 재시도·고객센터 안내 같은 다른 UI 를 띄울 수 있다',
    enum: AiConsultAnswerType,
    example: AiConsultAnswerType.FAQ_ANSWER,
  })
  tag: AiConsultAnswerType;

  @ApiProperty({
    description:
      '추천 질문. 그대로 눌러서 message 로 다시 보내면 된다. ' +
      '답변이 확실할 때는 되물을 게 없으므로 빈 배열이다',
    type: [String],
    example: ['배송 기간', '환불 방법', '사이즈 확인'],
  })
  suggestions: string[];

  @ApiProperty({
    description:
      '입점 브랜드 목록. tag 가 BRAND_LIST 일 때만 채워지고 그 외에는 빈 배열이다. ' +
      '이름·이미지는 전부 DB 에서 재조회한 값이라 AI 가 지어낼 수 없다',
    type: [AiConsultBrandResponse],
  })
  brands: AiConsultBrandResponse[];

  @ApiProperty({
    description:
      '카테고리 목록. tag 가 CATEGORY_LIST 면 대분류, PRODUCT_CATEGORY_LIST 면 ' +
      'parentCategory 에 속한 소분류가 담긴다. 그 외 tag 에서는 빈 배열이다',
    type: [AiConsultCategoryResponse],
  })
  categories: AiConsultCategoryResponse[];

  @ApiProperty({
    description:
      '소분류 목록의 상위 대분류. tag 가 PRODUCT_CATEGORY_LIST 일 때만 채워진다. ' +
      '브레드크럼이나 "다른 카테고리 보기" 동선에 쓴다',
    type: AiConsultCategoryResponse,
    nullable: true,
  })
  parentCategory: AiConsultCategoryResponse | null;

  static from(dto: AiConsultAnswerDto) {
    return plainToInstance(this, {
      answer: dto.answer,
      tag: dto.answerType,
      suggestions: dto.suggestions,
      brands: dto.brands,
      categories: dto.categories,
      parentCategory: dto.parentCategory,
    });
  }
}

function toEnumValue<T extends Record<string, string>>(
  enumType: T,
  value: unknown,
): T[keyof T] | null {
  if (typeof value !== 'string') return null;

  return Object.values(enumType).includes(value) ? (value as T[keyof T]) : null;
}

/**
 * LLM 이 돌려준 raw JSON 을 신뢰 경계 안으로 들여오는 지점.
 *
 * responseSchema 로 형태를 강제하고 있지만 모델 버전업·SDK 교체로 스키마가
 * 느슨해질 수 있으므로 enum 소속과 confidence 범위를 여기서 다시 검증한다.
 * JSON.parse 도 이 DTO 안에 가둬 손상된 캐시 값 하나가 500 을 유발하지 않게 한다.
 */
export class AiConsultClassificationDto {
  scope: AiConsultScope = AiConsultScope.OUT_OF_SCOPE;
  /**
   * 값이 없으면 FAQ 로 떨어진다.
   * intent 도입 이전에 저장된 캐시 값에는 이 필드가 없으므로 기본값이 곧 하위 호환이다.
   */
  intent: AiConsultIntent = AiConsultIntent.FAQ;
  /**
   * 모델이 뱉은 카테고리 이름. **조회 키로만 쓰고 고객 문장에 넣지 않는다.**
   * 지목이 없으면 빈 문자열이며, 이때는 대분류 전체 목록을 의미한다.
   */
  categoryQuery = '';
  /** FAQ_NONE 은 null 로 정규화된다. */
  faqCode: string | null = null;
  confidence = 0;
  prefaceId: AiConsultPrefaceId = AiConsultPrefaceId.NEUTRAL;
  alternatives: string[] = [];
  /** 내부 분석용. 고객에게 노출하지 않는다. */
  reason: string | null = null;

  static fromRaw(raw: unknown): AiConsultClassificationDto | null {
    if (!raw || typeof raw !== 'object') return null;

    const source = raw as Record<string, unknown>;
    const scope = toEnumValue(AiConsultScope, source.scope);

    if (!scope) return null;

    const dto = new AiConsultClassificationDto();

    dto.scope = scope;
    dto.prefaceId =
      toEnumValue(AiConsultPrefaceId, source.prefaceId) ??
      AiConsultPrefaceId.NEUTRAL;
    dto.reason = typeof source.reason === 'string' ? source.reason : null;

    if (scope !== AiConsultScope.IN_SCOPE) {
      dto.intent = AiConsultIntent.NONE;

      return dto;
    }

    dto.intent =
      toEnumValue(AiConsultIntent, source.intent) ?? AiConsultIntent.FAQ;
    dto.categoryQuery = this.normalizeCategoryQuery(source.categoryQuery);
    dto.faqCode = this.normalizeFaqCode(source.faqCode);
    dto.confidence = dto.faqCode
      ? this.normalizeConfidence(source.confidence)
      : 0;
    dto.alternatives = this.normalizeAlternatives(source.alternatives);

    return dto;
  }

  /** 자유 텍스트 슬롯이므로 길이만 자른다. 매칭 규칙은 카탈로그가 담당한다. */
  private static normalizeCategoryQuery(value: unknown): string {
    if (typeof value !== 'string') return '';

    return value.trim().slice(0, AI_CONSULT_MAX_CATEGORY_QUERY_LENGTH);
  }

  private static normalizeFaqCode(value: unknown): string | null {
    if (typeof value !== 'string' || value === FAQ_NONE) return null;

    return findFaqItem(value) ? value : null;
  }

  private static normalizeConfidence(value: unknown): number {
    if (typeof value !== 'number' || Number.isNaN(value)) return 0;

    return Math.min(1, Math.max(0, value));
  }

  private static normalizeAlternatives(value: unknown): string[] {
    if (!Array.isArray(value)) return [];

    return value
      .filter((code): code is string => typeof code === 'string')
      .filter((code) => findFaqItem(code) !== null)
      .slice(0, MAX_SUGGESTION_COUNT);
  }

  /** 문장이 아니라 판정 결과만 캐시한다 → FAQ 문구 수정이 캐시 무효화 없이 즉시 반영된다. */
  toCacheJson(): string {
    return JSON.stringify({
      scope: this.scope,
      intent: this.intent,
      categoryQuery: this.categoryQuery,
      faqCode: this.faqCode,
      confidence: this.confidence,
      prefaceId: this.prefaceId,
      alternatives: this.alternatives,
    });
  }

  /** 파싱 실패는 캐시 미스로 취급한다. */
  static parseCache(cached: string | null): AiConsultClassificationDto | null {
    if (!cached) return null;

    try {
      return this.fromRaw(JSON.parse(cached));
    } catch {
      return null;
    }
  }
}

/**
 * 요청 1건에서 파생된 값 묶음.
 * 오케스트레이션이 여러 private 메서드로 쪼개지므로 언어·질문·유저를 함께 옮긴다.
 */
export class AiConsultRequestContextDto {
  language: LanguageCode;
  /** sanitizeMessage() 를 거친 질문 */
  question: string;
  /** 게스트면 undefined — DB 로그를 남기지 않는다. */
  userId?: number;

  static from(
    language: LanguageCode,
    question: string,
    userId?: number,
  ): AiConsultRequestContextDto {
    const dto = new AiConsultRequestContextDto();

    dto.language = language;
    dto.question = question;
    dto.userId = userId;

    return dto;
  }
}

/**
 * FAQ 매칭 없이 상수 문구만 내보내는 답변 종류.
 * FAQ_ANSWER/CONFIRM_SUGGESTION 은 매칭된 항목이 있어야 문장이 완성되므로 제외한다.
 */
export type AiConsultCannedAnswerType =
  | AiConsultAnswerType.FALLBACK
  | AiConsultAnswerType.OFF_TOPIC
  | AiConsultAnswerType.RATE_LIMITED
  | AiConsultAnswerType.UNAVAILABLE;

/** 레이트리밋·일일 예산 판정 결과. 차단 사유에 따라 canned 응답이 달라진다. */
export class AiConsultLimitDto {
  allowed = true;
  blockedAnswerType: AiConsultCannedAnswerType | null = null;

  static allow(): AiConsultLimitDto {
    return new AiConsultLimitDto();
  }

  static rateLimited(): AiConsultLimitDto {
    return this.block(AiConsultAnswerType.RATE_LIMITED);
  }

  static unavailable(): AiConsultLimitDto {
    return this.block(AiConsultAnswerType.UNAVAILABLE);
  }

  private static block(
    answerType: AiConsultCannedAnswerType,
  ): AiConsultLimitDto {
    const dto = new AiConsultLimitDto();

    dto.allowed = false;
    dto.blockedAnswerType = answerType;

    return dto;
  }
}

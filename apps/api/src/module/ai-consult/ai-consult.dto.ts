import { RedisKey } from '@app/cache/cache.dto';
import { SupportEnv } from '@app/config/enum/config.enum';
import { AiConsultNameMatchMeta } from '@app/repository/dto/ai-consult.dto';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import {
  AiConsultAnswerType,
  AiConsultNameMatchType,
  AiConsultIntent,
  AiConsultScope,
} from '@app/repository/enum/ai-consult.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { createHash } from 'crypto';

import { normalizeHexCode, parseHexToLab } from './ai-consult.color';
import { AiConsultPrefaceId, FAQ_NONE, findFaqItem } from './ai-consult.faq';
import { findBestSimilarity, toJamo } from './ai-consult.similarity';
import { MultilingualFieldDto } from '../dto/multilingual.dto';
import { GetProductRequest } from '../product/product.dto';

export const AI_CONSULT_MIN_MESSAGE_LENGTH = 2;
export const AI_CONSULT_MAX_MESSAGE_LENGTH = 300;

/** 이 값 이상이면 저장된 FAQ 답변을 그대로 내보낸다. */
export const CONFIDENCE_ANSWER_THRESHOLD = 0.7;
/** 이 값 이상 ANSWER 미만이면 확신이 부족하므로 되묻는다. */
export const CONFIDENCE_CONFIRM_THRESHOLD = 0.45;

export const ANSWER_CACHE_TTL_SECONDS = 60 * 60 * 24;
/**
 * "네", "?" 같은 무의미 입력까지 캐시해 키 공간을 오염시키지 않도록 둔 하한.
 *
 * 6 이면 실사용 최다 질문인 "배송 기간"·"환불 방법"(각 5자)이 걸려 **한 번도 캐시되지
 * 않는다.** 운영 로그에서 이 두 질문은 전건 LLM 을 탔다. 입력 최소 길이가 2자이므로
 * 4 로 낮춰도 한두 글자 잡음은 그대로 걸러진다.
 */
export const ANSWER_CACHE_MIN_LENGTH = 4;

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
export const NAME_FUZZY_MATCH_THRESHOLD = 0.7;
/**
 * 1·2위 유사도 차이가 이 값 미만이면 매칭하지 않는다.
 * "가방"/"가발"처럼 서로 닮은 카테고리가 둘 다 후보로 남았을 때,
 * 반반 확률로 찍어 엉뚱한 목록을 보여주느니 되묻는 편이 낫다.
 */
export const NAME_FUZZY_MATCH_MARGIN = 0.05;
/**
 * 유사도 매칭을 적용할 이름의 최소 자모 길이(한글 2음절 상당).
 * 짧은 이름은 한 글자만 달라도 유사도가 높게 나와 오탐이 된다.
 */
export const NAME_FUZZY_MIN_LENGTH = 4;

/** option_value 의 다국어 이름은 'name' 이 아니라 'value' 필드에 들어있다. */
export const OPTION_VALUE_NAME_FIELD = 'value';

/**
 * 표기 변형("배송 얼마나 걸려요?" / " 배송  얼마나 걸려요? ")을 한 키로 모은다.
 * 세션이 없어 모든 질문이 자기완결적이므로 문맥 의존 오답 캐시 위험이 없다.
 *
 * `promptFingerprint` 는 프롬프트가 바뀌면 키 공간을 통째로 갈아 옛 판정을
 * 버리기 위한 것이다. 이게 없으면 규칙을 고쳐도 캐시된 판정이 24시간 남는다.
 */
export function buildAnswerCacheKey(
  question: string,
  language: LanguageCode,
  promptFingerprint: string,
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

  return `${RedisKey.AI_CONSULT_ANSWER}:${promptFingerprint}:${language}:${hash}`;
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

export class AiConsultColorResponse {
  @ApiProperty({ description: '옵션값(색상) ID', example: 17 })
  id: number;

  @ApiProperty({ description: '색상 이름', example: '빨강' })
  name: string;

  @ApiProperty({
    description: '색상 코드. 미등록이면 null',
    example: '#FF0000',
    nullable: true,
  })
  code: string | null;

  static from(id: number, name: string, code: string | null) {
    return plainToInstance(this, { id, name, code });
  }
}

/** 카탈로그 입력. option_value 는 색상 코드를 갖는다. */
export interface AiConsultColorSource {
  id: number;
  code: string | null;
}

/**
 * 채팅에 뿌릴 상품 카드.
 *
 * `GetProductResponse` 를 그대로 내보내지 않는다 — 거기엔 아직 리뷰 수·평점이
 * 임시값으로 채워져 있어서 상담 답변에 실리면 사실이 아닌 수치를 말하게 된다.
 * 확정된 값만 골라 담는다.
 */
export class AiConsultProductResponse {
  @ApiProperty({ description: '상품 아이템 ID', example: 91 })
  id: number;

  @ApiProperty({ description: '상품 이름', example: '코튼 오버핏 셔츠' })
  name: string;

  @ApiProperty({ description: '브랜드 이름', example: '서울모먼트' })
  brandName: string;

  @ApiProperty({ description: '가격(할인가가 있으면 할인가)', example: 39000 })
  price: number;

  @ApiProperty({
    description: '대표 이미지 URL',
    example: 'https://image-dev.seoulmoment.com.tw/product/shirt.png',
    nullable: true,
  })
  image: string | null;

  static from(
    id: number,
    name: string,
    brandName: string,
    price: number,
    image: string | null,
  ) {
    return plainToInstance(this, { id, name, brandName, price, image });
  }
}

/**
 * 실제로 적용된 검색 조건.
 *
 * 모델이 지목한 조건 중 DB 에 붙지 못한 것은 여기 빠진다. "검정 옷"에서
 * 색상만 붙고 카테고리가 빠졌다면 고객·프론트가 그걸 알아야 결과를
 * 오해하지 않는다. 값은 전부 DB 에서 읽은 이름이다.
 */
export class AiConsultAppliedFilterResponse {
  @ApiProperty({
    description: '적용된 카테고리 이름. 못 붙였으면 null',
    example: '패션',
    nullable: true,
  })
  category: string | null;

  @ApiProperty({
    description: '적용된 색상 이름. 못 붙였으면 null',
    example: '검정',
    nullable: true,
  })
  color: string | null;

  @ApiProperty({
    description:
      '적용된 상품명 검색어. 없으면 null. 카테고리·색상과 달리 DB 이름이 아니라 ' +
      '모델이 뽑은 검색어이므로 화면에 그대로 렌더링할 때 이스케이프가 필요하다',
    example: '드라이핏',
    nullable: true,
  })
  keyword: string | null;

  static from(
    category: string | null,
    color: string | null,
    keyword: string | null,
  ) {
    return plainToInstance(this, { category, color, keyword });
  }

  /** 실제로 필터가 하나라도 걸렸는가. */
  hasAny(): boolean {
    return (
      this.category !== null || this.color !== null || this.keyword !== null
    );
  }

  /**
   * 고객 문장에 넣어도 되는 조건이 있는가.
   * keyword 는 모델 출력이라 제외한다 — 인젝션 문구가 답변에 실릴 수 있다.
   */
  hasDisplayable(): boolean {
    return this.category !== null || this.color !== null;
  }
}

/** 유사도 순위 한 칸. 어떤 이름과 몇 점으로 붙었는지까지 들고 다닌다. */
interface AiConsultNameCandidate {
  id: number;
  name: string;
  score: number;
}

/** 색공간 거리로 걸린 색상 후보 한 칸. */
export interface AiConsultColorHexCandidate {
  id: number;
  name: string;
  deltaE: number;
}

/**
 * 카테고리 이름 매칭 결과.
 *
 * `number | null` 만 돌려주면 못 찾은 이유가 사라져 로그로 임계값을 조정할 수
 * 없다. 매칭된 id 와 함께 "어느 단계에서, 몇 점으로" 결판났는지를 같이 옮긴다.
 */
export class AiConsultNameMatchDto {
  private constructor(
    private readonly id: number | null,
    private readonly type: AiConsultNameMatchType,
    private readonly score: number | null,
    private readonly runnerUpScore: number | null,
    private readonly candidate: string | null,
    /**
     * 같은 계열로 함께 걸린 나머지 id. 색상 hex 경로에서만 채워진다.
     * 이름 매칭은 정의상 하나로 좁히는 작업이라 항상 비어 있다.
     */
    private readonly siblingIds: readonly number[] = [],
    private readonly deltaE: number | null = null,
  ) {}

  static exact(id: number, name: string): AiConsultNameMatchDto {
    return new AiConsultNameMatchDto(
      id,
      AiConsultNameMatchType.EXACT,
      null,
      null,
      name,
    );
  }

  static partial(id: number, name: string): AiConsultNameMatchDto {
    return new AiConsultNameMatchDto(
      id,
      AiConsultNameMatchType.PARTIAL,
      null,
      null,
      name,
    );
  }

  static noCandidate(): AiConsultNameMatchDto {
    return new AiConsultNameMatchDto(
      null,
      AiConsultNameMatchType.NO_CANDIDATE,
      null,
      null,
      null,
    );
  }

  static emptyCatalog(): AiConsultNameMatchDto {
    return new AiConsultNameMatchDto(
      null,
      AiConsultNameMatchType.EMPTY_CATALOG,
      null,
      null,
      null,
    );
  }

  /**
   * 색공간 거리로 붙은 결과.
   *
   * 가장 가까운 색을 대표로 두되 같은 계열 색을 전부 들고 간다 — "하늘색 옷"에
   * 스카이블루만 주고 라이트블루를 빼면 고객 눈에는 재고가 없는 것처럼 보인다.
   */
  static hexNearest(
    candidates: readonly AiConsultColorHexCandidate[],
  ): AiConsultNameMatchDto {
    const [best, ...siblings] = candidates;

    return new AiConsultNameMatchDto(
      best.id,
      AiConsultNameMatchType.HEX_NEAREST,
      null,
      null,
      best.name,
      siblings.map((candidate) => candidate.id),
      best.deltaE,
    );
  }

  /** 임계값·마진 판정을 여기 가둬 호출부가 점수를 직접 비교하지 않게 한다. */
  static fromSimilarity(
    best: AiConsultNameCandidate,
    runnerUp: AiConsultNameCandidate | null,
  ): AiConsultNameMatchDto {
    const runnerUpScore = runnerUp?.score ?? null;
    const build = (
      id: number | null,
      type: AiConsultNameMatchType,
    ): AiConsultNameMatchDto =>
      new AiConsultNameMatchDto(id, type, best.score, runnerUpScore, best.name);

    if (best.score < NAME_FUZZY_MATCH_THRESHOLD) {
      return build(null, AiConsultNameMatchType.BELOW_THRESHOLD);
    }

    if (
      runnerUpScore !== null &&
      best.score - runnerUpScore < NAME_FUZZY_MATCH_MARGIN
    ) {
      return build(null, AiConsultNameMatchType.AMBIGUOUS);
    }

    return build(best.id, AiConsultNameMatchType.SIMILARITY);
  }

  /** 못 찾았으면 null. 호출부는 이 값으로 FALLBACK 여부를 가른다. */
  getId(): number | null {
    return this.id;
  }

  /**
   * 매칭된 id 전부. 이름 매칭은 항상 1개, 색상 hex 매칭은 같은 계열 개수만큼이다.
   * 못 찾았으면 빈 배열이라 호출부가 그대로 필터에 넘길 수 있다.
   */
  getIds(): number[] {
    return this.id === null ? [] : [this.id, ...this.siblingIds];
  }

  /** 점수는 로그 가독성을 위해 소수점 3자리로 자른다. */
  toLogMeta(): AiConsultNameMatchMeta {
    const round = (value: number | null): number | undefined =>
      value === null ? undefined : Math.round(value * 1000) / 1000;

    return {
      type: this.type,
      score: round(this.score),
      runnerUpScore: round(this.runnerUpScore),
      candidate: this.candidate ?? undefined,
      deltaE:
        this.deltaE === null ? undefined : Math.round(this.deltaE * 10) / 10,
      // 1개면 이름 매칭과 다를 게 없으므로 여러 개 걸렸을 때만 남긴다.
      matchedCount: this.siblingIds.length ? this.getIds().length : undefined,
    };
  }
}

/**
 * 표기 차이를 흡수해 이름을 비교 가능한 형태로 만든다.
 * "화장품 " / "화 장 품" / "Cosmetics" 를 한 키로 모은다.
 */
export function normalizeMatchName(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

/**
 * 이름 → ID 색인.
 *
 * 모델이 뱉은 자유 텍스트를 DB 실데이터에 붙이는 유일한 지점이라 매칭 규칙을
 * 여기 한 곳에 가둔다. 카테고리든 색상이든 규칙이 같아야 "악세사리"는 잡히고
 * "빨강"은 안 잡히는 식의 비대칭이 생기지 않는다.
 *
 * 색인은 **모든 언어의 이름**으로 만든다 — Accept-Language 가 en 이어도
 * 고객은 한국어로 물을 수 있다.
 */
export class AiConsultNameIndexDto {
  private constructor(private readonly idByName: ReadonlyMap<string, number>) {}

  static from(entries: ReadonlyMap<string, number>): AiConsultNameIndexDto {
    return new AiConsultNameIndexDto(entries);
  }

  /**
   * 완전일치 → 부분일치 → 자모 유사도 순으로 내려간다.
   * 못 찾아도 "어디까지 갔는지"를 담은 결과를 돌려준다 — 호출부가 FALLBACK 을
   * 내면서 그 이유를 로그에 남길 수 있어야 임계값을 근거 있게 조정한다.
   */
  findMatch(query: string): AiConsultNameMatchDto {
    return this.findExactOrPartial(query) ?? this.findBySimilarity(query);
  }

  /**
   * 확실한 단계만. 못 찾으면 null 을 돌려 호출부가 다른 수단을 먼저 시도할 수 있게 한다.
   *
   * 색상은 이 뒤에 색공간 비교를 끼워 넣는다 — 자모 유사도가 짧은 이름에서
   * "보라"를 "소라"에 0.75 로 붙여버리기 때문이다.
   */
  findExactOrPartial(query: string): AiConsultNameMatchDto | null {
    const normalized = normalizeMatchName(query);

    if (!normalized) return null;

    const exact = this.idByName.get(normalized);

    if (exact !== undefined) {
      return AiConsultNameMatchDto.exact(exact, normalized);
    }

    return this.findLongestContained(normalized);
  }

  /**
   * "화장품은" / "화장품 카테고리" 처럼 조사·수식어가 붙은 경우를 흡수한다.
   *
   * **가장 긴 이름**을 골라야 한다. 이름은 서로를 품을 수 있어서("리드그레이"가
   * "그레이"를, "네온옐로우"가 "옐로우"를) 먼저 만난 것을 쓰면 짧은 쪽이 이겨버린다.
   * 실측에서 "리드그레이색"이 그레이로, "네온옐로우색"이 옐로우로 붙었다.
   *
   * 1글자 이름은 우연히 포함될 확률이 높아 대상에서 제외한다.
   */
  private findLongestContained(
    normalized: string,
  ): AiConsultNameMatchDto | null {
    let longestName: string | null = null;
    let longestId = 0;

    for (const [name, id] of this.idByName) {
      if (name.length < 2 || !normalized.includes(name)) continue;

      if (longestName === null || name.length > longestName.length) {
        longestName = name;
        longestId = id;
      }
    }

    return longestName === null
      ? null
      : AiConsultNameMatchDto.partial(longestId, longestName);
  }

  /** 표기 흔들림 구제 단계. 이름이 짧을수록 오탐이 늘어 마지막에 둔다. */
  findBySimilarity(query: string): AiConsultNameMatchDto {
    const normalized = normalizeMatchName(query);

    if (!normalized) return AiConsultNameMatchDto.noCandidate();

    const ranked = this.rankBySimilarity(normalized);

    if (ranked.length === 0) return AiConsultNameMatchDto.noCandidate();

    return AiConsultNameMatchDto.fromSimilarity(ranked[0], ranked[1] ?? null);
  }

  /**
   * 마지막 구제 단계.
   *
   * 고객이 "악세사리"라고 써서 실제 이름 "악세서리"와 글자 단위로는 어긋나는
   * 경우까지 잡는다. 표기 흔들림은 고객 잘못이 아닌데 "그런 건 없다"로
   * 되묻는 것은 나쁜 경험이라 여기서 흡수한다.
   */
  private rankBySimilarity(normalized: string): AiConsultNameCandidate[] {
    const bestById = new Map<number, AiConsultNameCandidate>();

    for (const [name, id] of this.idByName) {
      if (toJamo(name).length < NAME_FUZZY_MIN_LENGTH) continue;

      const score = findBestSimilarity(normalized, name);
      const current = bestById.get(id);

      // 같은 대상의 다국어 이름 중 가장 잘 맞는 하나만 대표로 남긴다.
      if (!current || score > current.score) {
        bestById.set(id, { id, name, score });
      }
    }

    return [...bestById.values()].sort((a, b) => b.score - a.score);
  }
}

/**
 * 카테고리 목록 + 이름 색인.
 * 노출용 이름만 요청 언어로 고르고, 매칭은 `AiConsultNameIndexDto` 에 맡긴다.
 */
export class AiConsultCategoryCatalogDto {
  private constructor(
    private readonly items: AiConsultCategoryResponse[],
    private readonly index: AiConsultNameIndexDto,
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
        idByName.set(normalizeMatchName(text.content), source.id);
      }
    }

    return new AiConsultCategoryCatalogDto(
      items,
      AiConsultNameIndexDto.from(idByName),
    );
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

  findMatch(query: string): AiConsultNameMatchDto {
    return this.index.findMatch(query);
  }
}

/**
 * 색상 옵션값 목록 + 이름 색인.
 *
 * 카테고리와 구조가 같지만 다국어 필드명이 다르다 — option_value 의 이름은
 * `name` 이 아니라 `value` 에 들어있다. 이걸 틀리면 색인이 통째로 비어
 * 모든 색상 질의가 조용히 EMPTY_CATALOG 로 떨어진다.
 */
export class AiConsultColorCatalogDto {
  private constructor(
    private readonly items: AiConsultColorResponse[],
    private readonly index: AiConsultNameIndexDto,
  ) {}

  static from(
    sources: readonly AiConsultColorSource[],
    textList: MultilingualTextEntity[],
    language: LanguageCode,
  ): AiConsultColorCatalogDto {
    const items: AiConsultColorResponse[] = [];
    const idByName = new Map<string, number>();

    for (const source of sources) {
      const field = MultilingualFieldDto.fromByEntityList(
        textList.filter((text) => text.entityId === source.id),
        OPTION_VALUE_NAME_FIELD,
      );
      const name = field.getContentByLanguageWithFallback(language);

      // 이름이 없는 색상은 매칭도 노출도 불가능하다.
      if (!name) continue;

      items.push(AiConsultColorResponse.from(source.id, name, source.code));

      for (const text of field.texts) {
        idByName.set(normalizeMatchName(text.content), source.id);
      }
    }

    return new AiConsultColorCatalogDto(
      items,
      AiConsultNameIndexDto.from(idByName),
    );
  }

  getItems(): AiConsultColorResponse[] {
    return this.items;
  }

  getCount(): number {
    return this.items.length;
  }

  findItem(id: number): AiConsultColorResponse | null {
    return this.items.find((item) => item.id === id) ?? null;
  }

  /**
   * 완전·부분일치 → **색공간 거리** → 자모 유사도 순으로 내려간다.
   *
   * 이름 매칭을 맨 앞에 두는 것이 요점이다. DB 에 그 이름이 있으면 그게 정답이고,
   * 모델이 준 hex 로 우회할 이유가 없다("레드"를 물었는데 색공간을 돌 필요는 없다).
   *
   * 색공간을 자모보다 **먼저** 두는 것도 마찬가지로 중요하다. 색 이름은 짧아서 자모
   * 유사도가 쉽게 오답을 낸다 — "보라"와 "소라"는 자모 4개 중 1개 차이(0.75)로
   * 임계값을 넘어, 자모를 먼저 태우면 보라색 질의에 하늘색 상품이 나간다.
   * 자모는 "네이비색" 같은 DB 고유 이름의 표기 흔들림을 받아내는 자리에 남는다.
   *
   * @param hex 모델이 정규화한 표준 색(`#RRGGBB`). 없으면 색공간 단계를 건너뛴다.
   */
  findMatch(query: string, hex: string | null = null): AiConsultNameMatchDto {
    const matched = this.index.findExactOrPartial(query);

    if (matched) return matched;

    const candidates = this.findHexCandidates(hex);

    if (candidates.length > 0) {
      return AiConsultNameMatchDto.hexNearest(candidates);
    }

    // 색으로도 못 붙었으면 이름 유사도로 마지막 구제를 시도한다.
    // 실패해도 점수가 남아야 로그에서 임계값을 조정할 수 있다.
    return this.index.findBySimilarity(query);
  }

  /** 같은 계열로 판정된 색상을 가까운 순으로. DB 색 추가에 코드 변경이 필요 없는 지점이다. */
  private findHexCandidates(hex: string | null): AiConsultColorHexCandidate[] {
    const queryLab = parseHexToLab(hex);

    if (!queryLab) return [];

    const candidates: AiConsultColorHexCandidate[] = [];

    for (const item of this.items) {
      const lab = parseHexToLab(item.code);

      // color_code 가 비어 있으면 색으로 비교할 방법이 없다. 이름 경로에만 남는다.
      if (!lab || !queryLab.isSameFamily(lab)) continue;

      candidates.push({
        id: item.id,
        name: item.name,
        deltaE: queryLab.distanceTo(lab),
      });
    }

    return candidates.sort((a, b) => a.deltaE - b.deltaE);
  }
}

/** 상품 검색 시 한 번에 가져올 카드 수. 채팅 말풍선에 들어갈 만큼만. */
export const AI_CONSULT_PRODUCT_PAGE_SIZE = 8;

/**
 * 카테고리 슬롯이 어느 계층에 붙었는지.
 *
 * 상품 조회 파라미터가 계층마다 다르다(`categoryId` vs `productCategoryId`).
 * id 만 들고 다니면 "반팔"(소분류)을 대분류 파라미터에 넣어 조용히 0건이 나온다.
 */
export enum AiConsultCategoryLevel {
  CATEGORY = 'CATEGORY',
  PRODUCT_CATEGORY = 'PRODUCT_CATEGORY',
}

/**
 * 슬롯 하나(카테고리 또는 색상)의 해석 결과.
 * 붙은 id 와 DB 이름, 그리고 어떻게 붙었는지(로그용)를 함께 옮긴다.
 */
export class AiConsultResolvedSlotDto {
  private constructor(
    private readonly id: number | null,
    private readonly name: string | null,
    readonly match: AiConsultNameMatchDto,
    private readonly level: AiConsultCategoryLevel | null,
  ) {}

  static resolved(
    id: number,
    name: string,
    match: AiConsultNameMatchDto,
    level: AiConsultCategoryLevel | null = null,
  ): AiConsultResolvedSlotDto {
    return new AiConsultResolvedSlotDto(id, name, match, level);
  }

  static unresolved(match: AiConsultNameMatchDto): AiConsultResolvedSlotDto {
    return new AiConsultResolvedSlotDto(null, null, match, null);
  }

  getId(): number | null {
    return this.id;
  }

  /**
   * 필터에 걸 id 전부.
   * 색상은 같은 계열이 여러 개 붙을 수 있다 — "하늘색"에 스카이블루만 걸고
   * 라이트블루를 빼면 고객 눈에는 재고가 없는 것처럼 보인다.
   */
  getIds(): number[] {
    return this.match.getIds();
  }

  /** 대분류로 붙었을 때만 id. 계층을 안 가리면 조회 파라미터가 어긋난다. */
  getCategoryId(): number | null {
    return this.level === AiConsultCategoryLevel.CATEGORY ? this.id : null;
  }

  /** 소분류("반팔"·"모자")로 붙었을 때만 id. */
  getProductCategoryId(): number | null {
    return this.level === AiConsultCategoryLevel.PRODUCT_CATEGORY
      ? this.id
      : null;
  }

  /** DB 에서 읽은 이름. 고객 문장에 넣어도 안전한 유일한 값이다. */
  getName(): string | null {
    return this.name;
  }
}

/**
 * 상품 검색 조건 한 묶음.
 *
 * "고객이 말한 것"과 "실제로 DB 에 붙은 것"을 분리해서 들고 있는 게 요점이다.
 * 둘을 뭉치면 조건을 못 붙였는데 붙은 척하고 전체 목록을 보여주게 된다.
 */
export class AiConsultProductFilterDto {
  private constructor(
    private readonly categoryRequested: boolean,
    private readonly colorRequested: boolean,
    private readonly category: AiConsultResolvedSlotDto | null,
    private readonly color: AiConsultResolvedSlotDto | null,
    private readonly keyword: string,
    readonly applied: AiConsultAppliedFilterResponse,
  ) {}

  static from(
    categoryQuery: string,
    colorQuery: string,
    category: AiConsultResolvedSlotDto | null,
    color: AiConsultResolvedSlotDto | null,
    keyword: string,
  ): AiConsultProductFilterDto {
    const resolvedKeyword =
      keyword ||
      this.buildRelaxedKeyword(categoryQuery, colorQuery, category, color);

    return new AiConsultProductFilterDto(
      Boolean(categoryQuery),
      Boolean(colorQuery),
      category,
      color,
      resolvedKeyword,
      AiConsultAppliedFilterResponse.from(
        category?.getName() ?? null,
        color?.getName() ?? null,
        // 키워드는 id 해석이 필요 없다 — 상품명 검색에 그대로 들어간다.
        resolvedKeyword || null,
      ),
    );
  }

  /**
   * 조건을 하나도 못 붙였을 때 고객이 쓴 말을 상품명 검색어로 재활용한다.
   *
   * 이게 없으면 "반팔 추천"처럼 카탈로그 이름에 없는 말을 쓴 순간 바로 "없습니다"가
   * 나간다. 상품명에는 들어있을 수 있으므로 한 번 더 찾아보고 그래도 0건일 때
   * 없다고 답하는 편이 맞다.
   *
   * 하나라도 붙었으면 손대지 않는다 — 붙은 조건에 키워드까지 얹으면 오히려 좁아진다.
   * 검색어는 `ILIKE '%...%'` 한 방이라 여러 낱말을 이어붙이면 아무것도 안 걸리므로
   * 하나만 고른다. 카테고리 쪽 말이 상품명에 등장할 확률이 높아 우선한다.
   */
  private static buildRelaxedKeyword(
    categoryQuery: string,
    colorQuery: string,
    category: AiConsultResolvedSlotDto | null,
    color: AiConsultResolvedSlotDto | null,
  ): string {
    if (category?.getId() != null || color?.getId() != null) return '';

    return categoryQuery || colorQuery || '';
  }

  get categoryMatch(): AiConsultNameMatchDto | null {
    return this.category?.match ?? null;
  }

  get colorMatch(): AiConsultNameMatchDto | null {
    return this.color?.match ?? null;
  }

  /**
   * 조건을 말했는데 붙일 것이 하나도 남지 않은 상태.
   *
   * 이때 필터 없이 조회하면 "검정 옷"에 아무 상품이나 나가므로 검색 자체를 막는다.
   * 완화 검색어(`buildRelaxedKeyword`)까지 비었을 때만 해당하므로 실제로는 드물다 —
   * 마지막 안전망이다.
   */
  isRequestedButUnresolved(): boolean {
    const requested = this.categoryRequested || this.colorRequested;

    return requested && !this.applied.hasAny();
  }

  /** 고객 문장에 넣을 조건 표기. DB 이름만 쓰고 keyword 는 뺀다. */
  describeFilter(): string {
    return [this.applied.category, this.applied.color]
      .filter((value): value is string => Boolean(value))
      .join(' · ');
  }

  toProductRequest(): GetProductRequest {
    // 같은 계열 색이 여러 개 붙었으면 전부 건다("하늘색"→스카이블루·라이트블루).
    const colorIds = this.color?.getIds() ?? [];

    return GetProductRequest.from(
      1,
      AI_CONSULT_PRODUCT_PAGE_SIZE,
      undefined,
      undefined,
      // 상품명 ILIKE 검색. multilingual_text(entityType='product') 를 뒤진다.
      this.keyword || undefined,
      undefined,
      this.category?.getCategoryId() ?? undefined,
      this.category?.getProductCategoryId() ?? undefined,
      // optionIdList 는 이름과 달리 option_value_id 목록이다.
      colorIds.length ? colorIds : undefined,
      undefined,
    );
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
  /** COLOR_LIST 응답에서만 채워진다. 값은 전부 DB 에서 재조회한 것이다. */
  colors: AiConsultColorResponse[] = [];
  /** 소분류 응답에서 상위 대분류. 그 외에는 null. */
  parentCategory: AiConsultCategoryResponse | null = null;
  /** PRODUCT_LIST 응답에서만 채워진다. */
  products: AiConsultProductResponse[] = [];
  /** PRODUCT_LIST / NOT_FOUND(상품 검색) 에서 실제로 적용된 조건. */
  appliedFilter: AiConsultAppliedFilterResponse | null = null;
  /** 상품 검색 결과 총 건수. 로그 전용. */
  productCount: number | null = null;
  /** 색상 이름 매칭 결과. **로그 전용이며 고객 응답에는 나가지 않는다.** */
  colorMatch: AiConsultNameMatchDto | null = null;
  /**
   * 카테고리 이름 매칭 결과. **로그 전용이며 고객 응답에는 나가지 않는다.**
   * 실패한 건에도 채워야 FALLBACK 의 원인을 사후에 가를 수 있다.
   */
  categoryMatch: AiConsultNameMatchDto | null = null;

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

  withColors(colors: AiConsultColorResponse[]): this {
    this.colors = colors;

    return this;
  }

  withCategoryMatch(match: AiConsultNameMatchDto): this {
    this.categoryMatch = match;

    return this;
  }

  /** 상품 검색 결과 한 묶음. 실패(0건)일 때도 조건·건수를 실어 로그에 남긴다. */
  withProductSearch(
    products: AiConsultProductResponse[],
    appliedFilter: AiConsultAppliedFilterResponse,
    productCount: number,
    categoryMatch: AiConsultNameMatchDto | null,
    colorMatch: AiConsultNameMatchDto | null,
  ): this {
    this.products = products;
    this.appliedFilter = appliedFilter;
    this.productCount = productCount;
    this.categoryMatch = categoryMatch;
    this.colorMatch = colorMatch;

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

  @ApiProperty({
    description:
      '취급 색상 목록. tag 가 COLOR_LIST 일 때만 채워지고 그 외에는 빈 배열이다. ' +
      'code 는 색상 칩을 그릴 때 쓰는 hex 값이며 미등록이면 null 이다',
    type: [AiConsultColorResponse],
  })
  colors: AiConsultColorResponse[];

  @ApiProperty({
    description:
      '상품 카드 목록. tag 가 PRODUCT_LIST 일 때만 채워지고 그 외에는 빈 배열이다. ' +
      '이름·가격·이미지는 전부 DB 에서 읽은 값이라 AI 가 지어낼 수 없다',
    type: [AiConsultProductResponse],
  })
  products: AiConsultProductResponse[];

  @ApiProperty({
    description:
      '실제로 적용된 검색 조건. 모델이 지목했어도 DB 에 붙지 못한 조건은 null 이다. ' +
      '"검정 옷"에서 색상만 붙었다면 category 가 null 이므로 결과를 좁게 해석하면 안 된다',
    type: AiConsultAppliedFilterResponse,
    nullable: true,
  })
  appliedFilter: AiConsultAppliedFilterResponse | null;

  static from(dto: AiConsultAnswerDto) {
    return plainToInstance(this, {
      answer: dto.answer,
      tag: dto.answerType,
      suggestions: dto.suggestions,
      brands: dto.brands,
      categories: dto.categories,
      parentCategory: dto.parentCategory,
      colors: dto.colors,
      products: dto.products,
      appliedFilter: dto.appliedFilter,
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
  /**
   * 모델이 뱉은 색상 이름. categoryQuery 와 같은 규칙으로 조회 키로만 쓴다.
   * PRODUCT_SEARCH 가 아닌 intent 에서는 비어 있다.
   */
  colorQuery = '';
  /**
   * 모델이 정규화한 색의 표준 hex. 형식이 어긋나면 빈 문자열이다.
   *
   * "빨강색"·"연한하늘색"처럼 표기가 흔들려도 여기서 같은 값으로 모인다.
   * 값이 없으면 색공간 경로를 건너뛰고 이름 매칭만 탄다 — 예전 코드가 표로 하던
   * 일을 모델이 하는 것이라, 모델이 못 내면 그만큼만 좁아지고 오답이 늘지는 않는다.
   */
  colorHex = '';
  /**
   * 카테고리·색상이 아닌 상품 검색어. 상품명 ILIKE 검색에 그대로 쓰인다.
   * **고객 문장에는 넣지 않는다** — 모델 출력이라 인젝션 문구가 섞일 수 있다.
   */
  keywordQuery = '';
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
    dto.categoryQuery = this.normalizeFreeTextSlot(source.categoryQuery);
    dto.colorQuery = this.normalizeFreeTextSlot(source.colorQuery);
    dto.colorHex = normalizeHexCode(source.colorHex) ?? '';
    dto.keywordQuery = this.normalizeFreeTextSlot(source.keywordQuery);
    dto.faqCode = this.normalizeFaqCode(source.faqCode);
    dto.confidence = dto.faqCode
      ? this.normalizeConfidence(source.confidence)
      : 0;
    dto.alternatives = this.normalizeAlternatives(source.alternatives);

    return dto;
  }

  /** 자유 텍스트 슬롯이므로 길이만 자른다. 매칭 규칙은 카탈로그가 담당한다. */
  private static normalizeFreeTextSlot(value: unknown): string {
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
      colorQuery: this.colorQuery,
      colorHex: this.colorHex,
      keywordQuery: this.keywordQuery,
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

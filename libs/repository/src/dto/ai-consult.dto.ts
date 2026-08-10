import { plainToInstance } from 'class-transformer';

import { AiConsultLogEntity } from '../entity/ai-consult-log.entity';
import {
  AiConsultAnswerSource,
  AiConsultAnswerType,
  AiConsultNameMatchType,
  AiConsultScope,
} from '../enum/ai-consult.enum';
import { LanguageCode } from '../enum/language.enum';

/**
 * 자유 텍스트에서 개인정보를 지운다.
 *
 * AI 상담은 고객이 주문번호·전화번호·주소를 자유롭게 입력하는 유일한 엔드포인트라
 * 원문을 그대로 적재하면 개별 파기가 불가능해진다. DB 저장과 Winston 로그가
 * 같은 마스킹을 쓰도록 이 파일에 둔다.
 */
export function maskPii(text: string): string {
  return (
    text
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[EMAIL]')
      .replace(/\b\d{6}[-\s]?[1-4]\d{6}\b/g, '[RRN]')
      .replace(/\b(?:\d[ -]?){13,16}\b/g, '[CARD]')
      // 한국 01x-xxxx-xxxx / 대만 09xx-xxx-xxx 를 모두 덮도록 뒤 두 그룹을 3~4자리로 둔다.
      .replace(/\b0(?:1[016-9]|9\d{2})[-\s]?\d{3,4}[-\s]?\d{3,4}\b/g, '[PHONE]')
  );
}

/** 분석용 부가 정보. 컬럼으로 올릴 만큼 안정적이지 않은 값만 담는다. */
export interface AiConsultLogMetaObject {
  /** Redis 답변 캐시 히트 여부 */
  cacheHit: boolean;
  /** LLM 이 제시한 대안 후보 */
  alternatives?: string[];
  /** 모델이 남긴 판정 근거 (고객 미노출) */
  reason?: string | null;
  /** 답변 앞에 붙은 도입부. faqCode + language 와 함께 answer 를 그대로 재현할 수 있다. */
  prefaceId?: string;
  /** 모델이 판정한 의도(FAQ / BRAND_LIST / CATEGORY_LIST / NONE). DB 실데이터 조회 비중을 집계한다. */
  intent?: string;
  /**
   * 모델이 지목한 카테고리 이름(원문). 매칭 실패로 FALLBACK 이 난 질문에서
   * 무엇을 못 찾았는지 보려면 이 값이 필요하다. 고객에게는 노출되지 않는다.
   */
  categoryQuery?: string;
  /** 위 categoryQuery 를 DB 이름에 붙이려다 어떻게 됐는지. 임계값 튜닝 근거다. */
  categoryMatch?: AiConsultNameMatchMeta;
  /** 모델이 지목한 색상 이름(원문). PRODUCT_SEARCH 에서만 채워진다. */
  colorQuery?: string;
  /**
   * 모델이 위 colorQuery 를 정규화한 표준 색(`#RRGGBB`).
   *
   * 색 매칭이 틀렸을 때 **모델이 색을 잘못 짚은 것**인지 **우리 게이트가 좁은 것**인지
   * 가르는 값이다. 이게 없으면 둘을 구분할 방법이 없어 임계값을 헛돌린다.
   */
  colorHex?: string;
  /** 위 colorQuery 의 매칭 결과. 색상만 따로 봐야 어느 슬롯이 샜는지 안다. */
  colorMatch?: AiConsultNameMatchMeta;
  /** 상품명 검색어. id 해석 없이 ILIKE 로 바로 들어가므로 매칭 결과가 없다. */
  keywordQuery?: string;
  /** 상품 검색 결과 건수. 0 건이면 조건은 붙었는데 재고가 없다는 뜻이다. */
  productCount?: number;
  /** 인젝션 마커가 감지됐는지 — 차단하지 않고 관찰만 한다 */
  injectionFlagged?: boolean;
}

/**
 * 카테고리 이름 매칭 결과.
 *
 * 실패한 건에도 1위 점수를 남기는 것이 요점이다. "0.68 이라 놓쳤다"와
 * "0.2 라 애초에 다른 단어였다"는 대응이 완전히 다른데, 점수가 없으면
 * 둘을 구분할 수 없어 임계값을 감으로 만지게 된다.
 */
export interface AiConsultNameMatchMeta {
  type: AiConsultNameMatchType;
  /** 유사도 단계까지 간 경우의 1위 점수 (0~1, 소수점 3자리) */
  score?: number;
  /** 2위 점수. 1위와 붙어 있으면 AMBIGUOUS 로 떨어진다. */
  runnerUpScore?: number;
  /** 1위 후보의 DB 이름. 무엇과 헷갈렸는지 보려면 필요하다. */
  candidate?: string;
  /** HEX_NEAREST 단계의 1위 색공간 거리(CIE76 ΔE, 소수점 1자리) */
  deltaE?: number;
  /**
   * HEX_NEAREST 로 붙은 색상 개수.
   * 색상은 같은 계열이면 여러 개를 함께 거는데("하늘"→스카이블루·라이트블루),
   * 몇 개가 걸렸는지 남겨야 검색 결과 수가 왜 그렇게 나왔는지 설명된다.
   */
  matchedCount?: number;
}

/**
 * 로그 저장 입력.
 *
 * 필드만 가진 클래스이므로 호출부에서 객체 리터럴을 그대로 넘겨도
 * 전 필드가 컴파일 타임에 검증된다.
 */
export class SaveAiConsultLogDto {
  /** 게스트면 null */
  userId: number | null;
  languageCode: LanguageCode;
  /** maskPii() 를 거친 값이어야 한다. */
  question: string;
  /** 분류를 수행하지 않았으면 null */
  scope: AiConsultScope | null;
  answerType: AiConsultAnswerType;
  answerSource: AiConsultAnswerSource;
  matchedFaqCode: string | null;
  confidence: number | null;
  model: string | null;
  promptTokens: number;
  outputTokens: number;
  estimatedCostMicroUsd: number;
  latencyMs: number;
  finishReason: string | null;
  errorKind: string | null;
  traceId: string | null;
  meta: AiConsultLogMetaObject;
}

/** FAQ 에 없던 질문 — 다음 FAQ 를 무엇으로 채울지 정하는 근거가 된다. */
export class AiConsultUnmatchedQuestionDto {
  question: string;
  languageCode: LanguageCode;
  answerType: AiConsultAnswerType;
  createDate: Date;

  static from(entity: AiConsultLogEntity) {
    return plainToInstance(this, {
      question: entity.question,
      languageCode: entity.languageCode,
      answerType: entity.answerType,
      createDate: entity.createDate,
    });
  }
}

interface AiConsultDailyStatRow {
  answer_type: AiConsultAnswerType;
  count: string;
  cost: string | null;
}

/** answerType 별 하루 집계. */
export class AiConsultDailyStatDto {
  answerType: AiConsultAnswerType;
  count: number;
  estimatedCostMicroUsd: number;

  static fromRow(row: AiConsultDailyStatRow) {
    return plainToInstance(this, {
      answerType: row.answer_type,
      count: Number(row.count),
      estimatedCostMicroUsd: Number(row.cost ?? 0),
    });
  }
}

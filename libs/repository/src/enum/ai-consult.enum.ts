/**
 * AI 상담 enum.
 *
 * 엔티티(libs/repository)가 import 하므로 apps/api 아래에 두면 레이어가 역전된다.
 * API 응답 DTO 도 이 파일을 참조한다.
 */

/** 질문이 서비스 범위 안인지에 대한 모델의 판정 */
export enum AiConsultScope {
  IN_SCOPE = 'IN_SCOPE',
  OUT_OF_SCOPE = 'OUT_OF_SCOPE',
  /** 지시 주입 시도. 고객에게는 OUT_OF_SCOPE 와 동일한 응답을 주고 로그에만 구분해 남긴다. */
  PROMPT_INJECTION = 'PROMPT_INJECTION',
}

/**
 * 고객이 무엇을 원하는지. FAQ 매칭과 DB 실데이터 조회를 가르는 슬롯이다.
 * 상품 검색을 붙일 때 PRODUCT_SEARCH 를 여기 추가하면 된다.
 */
export enum AiConsultIntent {
  /** 정적 FAQ 에서 답을 찾는다 (기본값) */
  FAQ = 'FAQ',
  /** 입점 브랜드 목록을 묻는다 — 서버가 DB 에서 읽어 채운다 */
  BRAND_LIST = 'BRAND_LIST',
  /**
   * 카테고리를 묻는다. 대분류 목록인지 특정 대분류의 소분류인지는
   * 모델이 아니라 `categoryQuery` 슬롯이 비었는지로 서버가 가른다.
   */
  CATEGORY_LIST = 'CATEGORY_LIST',
  /** 범위 외 질문이라 의도 자체가 없다 */
  NONE = 'NONE',
}

/**
 * 모델이 넘긴 카테고리 이름을 DB 실데이터에 붙일 때 어느 단계에서 결판났는지.
 *
 * FALLBACK 하나만 보면 "모델이 카테고리 질문으로 안 봤다"와 "봤는데 이름을
 * 못 붙였다"가 구분되지 않는다. 임계값을 조정할 근거도 남지 않으므로
 * 실패한 이유까지 값으로 남긴다.
 */
export enum AiConsultCategoryMatchType {
  /** 정규화 후 이름이 그대로 일치 */
  EXACT = 'EXACT',
  /** 질의가 이름을 통째로 포함 ("화장품 카테고리") */
  PARTIAL = 'PARTIAL',
  /** 자모 유사도로 구제 ("악세사리" → "악세서리") */
  SIMILARITY = 'SIMILARITY',
  /** 유사도 1위가 임계값 미달 — 아예 다른 단어였다 */
  BELOW_THRESHOLD = 'BELOW_THRESHOLD',
  /** 1·2위가 붙어 있어 찍지 않고 되물었다 */
  AMBIGUOUS = 'AMBIGUOUS',
  /** 비교할 대상이 없었다 — 질의가 정규화 후 비었거나 후보 이름이 모두 너무 짧다 */
  NO_CANDIDATE = 'NO_CANDIDATE',
  /**
   * 대분류 카탈로그 자체가 0건이라 비교를 시작도 못 했다.
   * 매칭 문제가 아니라 데이터 문제(카테고리 미등록·다국어 이름 누락)라서
   * 임계값을 아무리 낮춰도 해결되지 않는다. 반드시 구분해서 남긴다.
   */
  EMPTY_CATALOG = 'EMPTY_CATALOG',
}

/** 고객에게 실제로 어떤 종류의 답변이 나갔는지 */
export enum AiConsultAnswerType {
  /** 임계값을 넘겨 저장된 FAQ 답변을 그대로 반환 */
  FAQ_ANSWER = 'FAQ_ANSWER',
  /** DB 에서 읽은 입점 브랜드 목록을 반환 */
  BRAND_LIST = 'BRAND_LIST',
  /** DB 에서 읽은 대분류(category) 목록을 반환 */
  CATEGORY_LIST = 'CATEGORY_LIST',
  /** 특정 대분류에 속한 소분류(product_category) 목록을 반환 */
  PRODUCT_CATEGORY_LIST = 'PRODUCT_CATEGORY_LIST',
  /** 애매한 매칭 — 후보를 제시하고 되물음 */
  CONFIRM_SUGGESTION = 'CONFIRM_SUGGESTION',
  /** 매칭 실패 — 고객센터 유도 */
  FALLBACK = 'FALLBACK',
  /** 범위 외 질문 또는 인젝션 시도 */
  OFF_TOPIC = 'OFF_TOPIC',
  RATE_LIMITED = 'RATE_LIMITED',
  /** LLM 장애 또는 일일 예산 초과 */
  UNAVAILABLE = 'UNAVAILABLE',
}

/** 답변을 만들기 위해 무엇을 거쳤는지 (LLM 호출 여부 분석용) */
export enum AiConsultAnswerSource {
  LLM = 'LLM',
  ANSWER_CACHE = 'ANSWER_CACHE',
  /** LLM 미호출 — 프리필터·레이트리밋·예산 초과·장애 폴백 */
  CANNED = 'CANNED',
}

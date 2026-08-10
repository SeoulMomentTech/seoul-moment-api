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
  /**
   * 조건을 붙여 상품 자체를 찾거나 추천해 달라는 질문("검정 옷 추천좀").
   *
   * CATEGORY_LIST 와의 경계는 "분류를 묻는가 / 상품을 보여 달라는가" 다.
   * 색상 같은 상품 속성이 함께 나오면 이쪽이다.
   */
  PRODUCT_SEARCH = 'PRODUCT_SEARCH',
  /**
   * 어떤 색상을 취급하는지 **목록 자체**를 묻는다("무슨 색 있어?").
   *
   * CATEGORY_LIST 와 반드시 갈라야 한다. 하나로 묶으면 색상을 물었는데 카테고리
   * 목록이 나가고, 고객은 답이 어긋난 이유를 알 수 없다.
   */
  COLOR_LIST = 'COLOR_LIST',
  /**
   * 인사·응원·감탄처럼 이해는 되지만 답할 정보가 없는 말("안녕하세요", "신기하네").
   * 범위 외로 밀어내면 잡담에 "쇼핑 문의만 가능합니다"로 응수하게 된다.
   */
  SMALL_TALK = 'SMALL_TALK',
  /** 범위 외 질문이라 의도 자체가 없다 */
  NONE = 'NONE',
}

/**
 * 모델이 넘긴 자유 텍스트(카테고리·색상 등)를 DB 실데이터의 이름에 붙일 때
 * 어느 단계에서 결판났는지.
 *
 * FALLBACK 하나만 보면 "모델이 그 질문으로 안 봤다"와 "봤는데 이름을 못
 * 붙였다"가 구분되지 않는다. 임계값을 조정할 근거도 남지 않으므로
 * 실패한 이유까지 값으로 남긴다.
 */
export enum AiConsultNameMatchType {
  /** 정규화 후 이름이 그대로 일치 */
  EXACT = 'EXACT',
  /** 질의가 이름을 통째로 포함 ("화장품 카테고리" → "화장품") */
  PARTIAL = 'PARTIAL',
  /**
   * 반대로 **이름이 질의를 포함** ("모자" → "러닝 모자").
   *
   * 고객은 등록된 이름보다 넓은 말을 쓴다 — 소분류가 "러닝 모자"인데 "모자 뭐 있어?"
   * 라고 묻는다. 자모 유사도로는 못 잡는다("모자" vs "러닝모자"는 0.5).
   * 넓은 말에는 여러 개가 걸리므로 **전부** 매칭한다.
   */
  BROADER = 'BROADER',
  /** 자모 유사도로 구제 ("악세사리" → "악세서리") */
  SIMILARITY = 'SIMILARITY',
  /**
   * 색공간 거리로 구제 ("빨강" → 레드). 색상 전용 경로다.
   *
   * 자모 유사도는 표기 흔들림만 흡수할 수 있어 어휘가 다른 같은 색("빨강" vs "레드",
   * 유사도 0.167)은 못 붙인다. 이름 대신 `color_code` 의 hex 를 색공간에서 비교한
   * 결과이며, 같은 계열 색이 여러 개면 전부 매칭된다.
   */
  HEX_NEAREST = 'HEX_NEAREST',
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
  /** 조건에 맞는 상품 카드 목록을 반환 */
  PRODUCT_LIST = 'PRODUCT_LIST',
  /** DB 에서 읽은 취급 색상 목록을 반환 */
  COLOR_LIST = 'COLOR_LIST',
  /**
   * 인사·응원·감탄에 짧게 응대.
   *
   * FALLBACK 과 구분한다. "서울모먼트 화이팅"에 "이해하지 못했어요"로 답하면
   * 고객은 자기 표현이 잘못된 줄 알고 같은 말을 반복한다.
   */
  SMALL_TALK = 'SMALL_TALK',
  /** 애매한 매칭 — 후보를 제시하고 되물음 */
  CONFIRM_SUGGESTION = 'CONFIRM_SUGGESTION',
  /**
   * 질문은 이해했으나 해당하는 상품·카테고리가 실제로 없음.
   *
   * FALLBACK 과 반드시 구분한다. "노랑 옷 있어?" 에 "이해하지 못했어요" 라고
   * 답하면 고객은 자기 말이 잘못됐다고 생각해 같은 질문을 바꿔가며 반복한다.
   * 없는 것은 없다고 말해야 다음 행동으로 넘어갈 수 있다.
   */
  NOT_FOUND = 'NOT_FOUND',
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

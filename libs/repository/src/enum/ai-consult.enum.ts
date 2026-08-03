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

/** 고객에게 실제로 어떤 종류의 답변이 나갔는지 */
export enum AiConsultAnswerType {
  /** 임계값을 넘겨 저장된 FAQ 답변을 그대로 반환 */
  FAQ_ANSWER = 'FAQ_ANSWER',
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

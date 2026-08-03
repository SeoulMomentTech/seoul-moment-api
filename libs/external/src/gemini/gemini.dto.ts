import { GenerateContentResponseUsageMetadata, Schema } from '@google/genai';

/**
 * 클라이언트 provider 토큰.
 * service 파일이 module 파일을 import 하면 순환 참조가 되므로 dto 에 둔다.
 */
export const GEMINI_CLIENT = 'GEMINI_CLIENT';

/**
 * Gemini 호출 타임아웃.
 * libs/http 의 axios 타임아웃(10초)은 앱 전역 공유라 여기서 쓰지 않고,
 * SDK 의 per-call httpOptions.timeout 으로 이 클라이언트만 제어한다.
 *
 * ⚠️ API 가 허용하는 **최소 deadline 이 10초**다. 그보다 짧게 주면 호출이
 *    400(INVALID_ARGUMENT, "Manually set deadline ... is too short") 으로 즉시
 *    거절된다. 실측 p50 은 ~900ms 라 이 값이 실제로 걸리는 일은 드물다.
 */
export const GEMINI_TIMEOUT_MS = 10000;

/**
 * 재시도는 1회만 한다.
 * 429 는 쿼터 문제라 수백 ms 후에도 대개 실패하고, 2회 이상 재시도하면
 * 유저 대기가 길어지는 동시에 장애 상황에서 트래픽을 증폭시켜 회복을 방해한다.
 */
export const GEMINI_MAX_RETRY = 1;
export const GEMINI_RETRY_BASE_DELAY_MS = 250;
export const GEMINI_RETRY_JITTER_MS = 100;

export const GEMINI_MAX_OUTPUT_TOKENS = 256;

/**
 * thinkingBudget 0 = DISABLED.
 * 닫힌 enum 중 1개를 고르는 분류 태스크는 다단계 추론이 필요 없어 thinking 의
 * 정확도 이득이 사실상 없는데, thought 토큰은 output 단가로 과금되므로
 * 이 값을 빼먹으면 비용이 3배가 되고 p95 지연이 4배가 된다.
 *
 * 실측(2026-08): thinkingConfig 를 빼면 gemini-3.5-flash / 3-flash / 3.6-flash 는
 * thought 를 200~245 토큰 써버려 maxOutputTokens 안에서 JSON 이 잘린다.
 * 현재 모델(gemini-3.1-flash-lite)은 0 을 정상 수용한다.
 *
 * null 로 두면 thinkingConfig 필드 자체를 보내지 않는다. gemini-3.5-flash-lite 는
 * thinkingConfig 를 받기만 해도 400(INVALID_ARGUMENT) 을 내므로, 그 모델로 바꾸려면
 * 이 값을 null 로 두어야 한다.
 */
export const GEMINI_THINKING_BUDGET: number | null = 0;

/**
 * gemini-3.1-flash-lite 단가 (USD / 1M tokens, 2026-08 공식 가격표 기준).
 *
 * ⚠️ GEMINI_MODEL 을 바꾸면 이 두 값도 함께 고쳐야 한다. 안 고치면 분류 동작은
 *    멀쩡한데 ai_consult_log.estimated_cost_micro_usd 집계만 조용히 틀어진다.
 *    참고 단가: 3.5-flash-lite $0.30/$2.50, 3-flash $0.50/$3.00,
 *              3.5-flash $1.50/$9.00 (같은 프롬프트 기준 3.1-flash-lite 의 5.6배)
 */
export const GEMINI_INPUT_PRICE_PER_MILLION = 0.25;
export const GEMINI_OUTPUT_PRICE_PER_MILLION = 1.5;

export enum GeminiErrorKind {
  /** API 키 미설정 — 호출 자체를 하지 않음 (로컬/테스트 기본 상태) */
  NOT_CONFIGURED = 'NOT_CONFIGURED',
  TIMEOUT = 'TIMEOUT',
  /** 429 */
  RATE_LIMITED = 'RATE_LIMITED',
  /** 5xx, 네트워크 오류 */
  UNAVAILABLE = 'UNAVAILABLE',
  /** safety 필터 차단 — 재시도해도 결정적으로 동일 */
  SAFETY_BLOCKED = 'SAFETY_BLOCKED',
  /** 400/401/403 — 스키마나 키 문제이므로 재시도 무의미 */
  INVALID_REQUEST = 'INVALID_REQUEST',
  /** 응답이 비었거나 JSON 파싱 실패, MAX_TOKENS 로 잘림 */
  MALFORMED_OUTPUT = 'MALFORMED_OUTPUT',
}

const RETRYABLE_ERROR_KINDS: readonly GeminiErrorKind[] = [
  GeminiErrorKind.TIMEOUT,
  GeminiErrorKind.RATE_LIMITED,
  GeminiErrorKind.UNAVAILABLE,
];

export function isRetryableGeminiError(kind: GeminiErrorKind | null): boolean {
  return kind !== null && RETRYABLE_ERROR_KINDS.includes(kind);
}

export interface GeminiStructuredRequestDto {
  /** 정적 프리픽스. 매 요청 동일해야 implicit context caching 이 적용된다. */
  systemInstruction: string;
  /** 동적 부분 (유저 입력) */
  userContent: string;
  responseSchema: Schema;
  maxOutputTokens?: number;
  temperature?: number;
  /** null 이면 thinkingConfig 를 아예 보내지 않는다. */
  thinkingBudget?: number | null;
  timeoutMs?: number;
}

export class GeminiUsageDto {
  promptTokenCount = 0;
  candidatesTokenCount = 0;
  thoughtsTokenCount = 0;
  totalTokenCount = 0;

  static empty(): GeminiUsageDto {
    return new GeminiUsageDto();
  }

  static from(metadata?: GenerateContentResponseUsageMetadata): GeminiUsageDto {
    const usage = new GeminiUsageDto();

    if (!metadata) return usage;

    usage.promptTokenCount = metadata.promptTokenCount ?? 0;
    usage.candidatesTokenCount = metadata.candidatesTokenCount ?? 0;
    usage.thoughtsTokenCount = metadata.thoughtsTokenCount ?? 0;
    usage.totalTokenCount = metadata.totalTokenCount ?? 0;

    return usage;
  }

  /** thought 토큰도 output 단가로 과금되므로 output 쪽에 합산한다. */
  getOutputTokenCount(): number {
    return this.candidatesTokenCount + this.thoughtsTokenCount;
  }

  /**
   * 비용을 micro USD(1e-6 USD) 정수로 환산한다.
   * 정수로 저장해야 SUM() 집계 시 float 누적 오차가 없다.
   */
  getEstimatedCostMicroUsd(): number {
    const inputCost = this.promptTokenCount * GEMINI_INPUT_PRICE_PER_MILLION;
    const outputCost =
      this.getOutputTokenCount() * GEMINI_OUTPUT_PRICE_PER_MILLION;

    return Math.round(inputCost + outputCost);
  }
}

/**
 * 성공/실패를 예외가 아니라 값으로 표현한다.
 * ServiceError 를 던지면 글로벌 예외 필터가 5xx 로 응답해버려 챗봇 UX 가 깨지므로,
 * 폴백 결정권은 호출자(오케스트레이터)가 갖는다.
 */
export class GeminiStructuredResultDto<T> {
  ok = false;
  parsed: T | null = null;
  errorKind: GeminiErrorKind | null = null;
  usage: GeminiUsageDto = GeminiUsageDto.empty();
  latencyMs = 0;
  finishReason: string | null = null;

  static succeed<T>(
    parsed: T,
    usage: GeminiUsageDto,
    latencyMs: number,
    finishReason?: string | null,
  ): GeminiStructuredResultDto<T> {
    const result = new GeminiStructuredResultDto<T>();

    result.ok = true;
    result.parsed = parsed;
    result.usage = usage;
    result.latencyMs = latencyMs;
    result.finishReason = finishReason ?? null;

    return result;
  }

  static fail<T>(
    errorKind: GeminiErrorKind,
    usage: GeminiUsageDto,
    latencyMs: number,
    finishReason?: string | null,
  ): GeminiStructuredResultDto<T> {
    const result = new GeminiStructuredResultDto<T>();

    result.ok = false;
    result.errorKind = errorKind;
    result.usage = usage;
    result.latencyMs = latencyMs;
    result.finishReason = finishReason ?? null;

    return result;
  }
}

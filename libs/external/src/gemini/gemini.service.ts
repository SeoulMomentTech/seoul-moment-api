import { LoggerService } from '@app/common/log/logger.service';
import { Configuration } from '@app/config/configuration';
import {
  ApiError,
  FinishReason,
  GenerateContentConfig,
  GenerateContentResponse,
  GoogleGenAI,
} from '@google/genai';
import { Inject, Injectable } from '@nestjs/common';

import {
  GEMINI_CLIENT,
  GEMINI_MAX_OUTPUT_TOKENS,
  GEMINI_MAX_RETRY,
  GEMINI_RETRY_BASE_DELAY_MS,
  GEMINI_RETRY_JITTER_MS,
  GEMINI_THINKING_BUDGET,
  GEMINI_TIMEOUT_MS,
  GeminiErrorKind,
  GeminiStructuredRequestDto,
  GeminiStructuredResultDto,
  GeminiUsageDto,
  isRetryableGeminiError,
} from './gemini.dto';

const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR = 500;

/** safety/정책 필터에 걸린 경우 — 재시도해도 결정적으로 동일하다. */
const BLOCKED_FINISH_REASONS: readonly FinishReason[] = [
  FinishReason.SAFETY,
  FinishReason.RECITATION,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.BLOCKLIST,
  FinishReason.SPII,
];

@Injectable()
export class GeminiService {
  constructor(
    @Inject(GEMINI_CLIENT) private readonly client: GoogleGenAI | null,
    private readonly logger: LoggerService,
  ) {}

  /** API 키가 설정되어 실제 호출이 가능한지. */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * structured output(JSON) 을 강제해 1회 분류를 수행한다.
   * 예외를 던지지 않고 결과 객체로 성공/실패를 표현하므로, 폴백 결정은 호출자가 한다.
   */
  async generateStructured<T>(
    request: GeminiStructuredRequestDto,
  ): Promise<GeminiStructuredResultDto<T>> {
    if (!this.client) {
      return GeminiStructuredResultDto.fail<T>(
        GeminiErrorKind.NOT_CONFIGURED,
        GeminiUsageDto.empty(),
        0,
      );
    }

    let result = await this.callOnce<T>(this.client, request);

    for (let attempt = 0; attempt < GEMINI_MAX_RETRY; attempt++) {
      if (result.ok || !isRetryableGeminiError(result.errorKind)) break;

      await this.sleepBeforeRetry(attempt);
      result = await this.callOnce<T>(this.client, request);
    }

    if (!result.ok) {
      this.logger.warn('Gemini generateStructured failed', {
        errorKind: result.errorKind,
        finishReason: result.finishReason,
        latencyMs: result.latencyMs,
      });
    }

    return result;
  }

  private async callOnce<T>(
    client: GoogleGenAI,
    request: GeminiStructuredRequestDto,
  ): Promise<GeminiStructuredResultDto<T>> {
    const startedAt = Date.now();

    try {
      const response = await client.models.generateContent({
        model: Configuration.getConfig().GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: request.userContent }] }],
        config: this.buildConfig(request),
      });

      return this.parseResponse<T>(response, Date.now() - startedAt);
    } catch (error) {
      const errorKind = this.classifyError(error);

      // errorKind 만으로는 원인을 못 찾는다. 모델 미지원(404)·deadline 위반(400)·
      // 키 권한(403) 이 전부 INVALID_REQUEST 하나로 뭉개지므로 본문을 함께 남긴다.
      // API 에러 본문에는 API 키나 프롬프트가 들어있지 않다.
      this.logger.warn('Gemini call failed', {
        errorKind,
        status: error instanceof ApiError ? error.status : null,
        detail: String(error instanceof Error ? error.message : error).slice(
          0,
          300,
        ),
      });

      return GeminiStructuredResultDto.fail<T>(
        errorKind,
        GeminiUsageDto.empty(),
        Date.now() - startedAt,
      );
    }
  }

  private buildConfig(
    request: GeminiStructuredRequestDto,
  ): GenerateContentConfig {
    const thinkingBudget = request.thinkingBudget ?? GEMINI_THINKING_BUDGET;

    return {
      // 정적 프리픽스를 systemInstruction 에 두면 implicit context caching 이 걸린다.
      systemInstruction: request.systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: request.responseSchema,
      temperature: request.temperature ?? 0,
      maxOutputTokens: request.maxOutputTokens ?? GEMINI_MAX_OUTPUT_TOKENS,
      // null 이면 필드 자체를 빼야 한다. flash-lite 계열은 thinkingConfig 를
      // 받으면 400 을 내고, 대신 thinking 이 기본으로 꺼져 있다.
      ...(thinkingBudget === null
        ? {}
        : { thinkingConfig: { thinkingBudget } }),
      httpOptions: { timeout: request.timeoutMs ?? GEMINI_TIMEOUT_MS },
    };
  }

  /**
   * safety 로 차단되면 candidates 나 parts 가 아예 없으므로,
   * 가드 없이 접근하면 TypeError 로 500 이 난다.
   */
  private parseResponse<T>(
    response: GenerateContentResponse,
    latencyMs: number,
  ): GeminiStructuredResultDto<T> {
    const usage = GeminiUsageDto.from(response.usageMetadata);
    const blockReason = response.promptFeedback?.blockReason;

    if (blockReason) {
      return GeminiStructuredResultDto.fail<T>(
        GeminiErrorKind.SAFETY_BLOCKED,
        usage,
        latencyMs,
        blockReason,
      );
    }

    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason ?? null;

    if (!candidate || (finishReason && this.isBlocked(finishReason))) {
      return GeminiStructuredResultDto.fail<T>(
        GeminiErrorKind.SAFETY_BLOCKED,
        usage,
        latencyMs,
        finishReason,
      );
    }

    return this.parseJsonText<T>(response.text, usage, latencyMs, finishReason);
  }

  private parseJsonText<T>(
    text: string | undefined,
    usage: GeminiUsageDto,
    latencyMs: number,
    finishReason: FinishReason | null,
  ): GeminiStructuredResultDto<T> {
    // MAX_TOKENS 는 JSON 이 중간에 잘렸다는 뜻이라 파싱을 시도할 필요가 없다.
    if (finishReason === FinishReason.MAX_TOKENS || !text) {
      return GeminiStructuredResultDto.fail<T>(
        GeminiErrorKind.MALFORMED_OUTPUT,
        usage,
        latencyMs,
        finishReason,
      );
    }

    try {
      return GeminiStructuredResultDto.succeed<T>(
        JSON.parse(text) as T,
        usage,
        latencyMs,
        finishReason,
      );
    } catch {
      return GeminiStructuredResultDto.fail<T>(
        GeminiErrorKind.MALFORMED_OUTPUT,
        usage,
        latencyMs,
        finishReason,
      );
    }
  }

  private isBlocked(finishReason: FinishReason): boolean {
    return BLOCKED_FINISH_REASONS.includes(finishReason);
  }

  private classifyError(error: unknown): GeminiErrorKind {
    if (error instanceof ApiError) {
      if (error.status === HTTP_TOO_MANY_REQUESTS) {
        return GeminiErrorKind.RATE_LIMITED;
      }

      return error.status >= HTTP_SERVER_ERROR
        ? GeminiErrorKind.UNAVAILABLE
        : GeminiErrorKind.INVALID_REQUEST;
    }

    const message = error instanceof Error ? error.message : String(error);

    return /timeout|timed out|ETIMEDOUT|abort/i.test(message)
      ? GeminiErrorKind.TIMEOUT
      : GeminiErrorKind.UNAVAILABLE;
  }

  /** jitter 를 섞어 다중 태스크가 429 후 동시에 재돌진하는 것을 막는다. */
  private async sleepBeforeRetry(attempt: number): Promise<void> {
    const delay =
      GEMINI_RETRY_BASE_DELAY_MS * Math.pow(2, attempt) +
      Math.random() * GEMINI_RETRY_JITTER_MS;

    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

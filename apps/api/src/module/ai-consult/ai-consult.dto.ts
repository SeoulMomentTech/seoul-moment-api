import { RedisKey } from '@app/cache/cache.dto';
import { SupportEnv } from '@app/config/enum/config.enum';
import {
  AiConsultAnswerType,
  AiConsultScope,
} from '@app/repository/enum/ai-consult.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { createHash } from 'crypto';

import { AiConsultPrefaceId, FAQ_NONE, findFaqItem } from './ai-consult.faq';

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

/**
 * 서비스 내부 결과.
 *
 * 고객 응답(`PostAiConsultAskResponse`)에는 answer/suggestions 만 나가지만,
 * 로그에는 판정 정보(answerType·faqCode·confidence)가 있어야 튜닝이 가능하다.
 * 그래서 "내부에서 아는 것"과 "밖에 내보내는 것"을 타입으로 분리한다.
 */
export class AiConsultAnswerDto {
  answer: string;
  answerType: AiConsultAnswerType;
  faqCode: string | null;
  confidence: number | null;
  /** 추천 질문 제목. 유저가 칩을 누르면 이 문자열을 그대로 message 로 보내면 된다. */
  suggestions: string[];

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

  static from(dto: AiConsultAnswerDto) {
    return plainToInstance(this, {
      answer: dto.answer,
      tag: dto.answerType,
      suggestions: dto.suggestions,
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

    if (scope !== AiConsultScope.IN_SCOPE) return dto;

    dto.faqCode = this.normalizeFaqCode(source.faqCode);
    dto.confidence = dto.faqCode
      ? this.normalizeConfidence(source.confidence)
      : 0;
    dto.alternatives = this.normalizeAlternatives(source.alternatives);

    return dto;
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

import { plainToInstance } from 'class-transformer';

import { AiConsultLogEntity } from '../entity/ai-consult-log.entity';
import {
  AiConsultAnswerSource,
  AiConsultAnswerType,
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
  /** 인젝션 마커가 감지됐는지 — 차단하지 않고 관찰만 한다 */
  injectionFlagged?: boolean;
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

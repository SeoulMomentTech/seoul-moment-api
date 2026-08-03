import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { AiConsultLogMetaObject } from '../dto/ai-consult.dto';
import {
  AiConsultAnswerSource,
  AiConsultAnswerType,
  AiConsultScope,
} from '../enum/ai-consult.enum';
import { LanguageCode } from '../enum/language.enum';

/**
 * AI 상담 CS 로그. **게스트 포함 전건**을 적재한다.
 *
 * User 와 ManyToOne 관계를 걸지 않는 이유: 유저 탈퇴가 CS 이력을 지우면 안 되고,
 * 상담 응답 경로에 FK 제약으로 인한 실패 지점을 만들지 않기 위해서다.
 *
 * ⚠️ 게스트 질문까지 쌓이므로 개인정보 보관 범위가 넓다. question 은 반드시
 *    maskPii() 를 거친 값만 저장하고, 90일 파기 배치를 붙이는 것이 전제다.
 */
@Index(['userId', 'createDate'])
@Index(['scope', 'createDate'])
@Index(['matchedFaqCode', 'createDate'])
@Entity('ai_consult_log')
export class AiConsultLogEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  /** 게스트 요청이면 null */
  @Column('int', { nullable: true })
  userId: number | null;

  @Column('varchar', { length: 10, nullable: false })
  languageCode: LanguageCode;

  @Column('varchar', {
    length: 400,
    nullable: false,
    comment: '고객 질문 (PII 마스킹 후 저장)',
  })
  question: string;

  /** 분류를 수행하지 않은 경우(레이트리밋·예산 초과·LLM 장애)에는 null 이다. */
  @Column('enum', { enum: AiConsultScope, nullable: true })
  scope: AiConsultScope | null;

  @Column('enum', { enum: AiConsultAnswerType, nullable: false })
  answerType: AiConsultAnswerType;

  @Column('enum', { enum: AiConsultAnswerSource, nullable: false })
  answerSource: AiConsultAnswerSource;

  @Column('varchar', { length: 64, nullable: true })
  matchedFaqCode: string | null;

  @Column('numeric', { precision: 4, scale: 3, nullable: true })
  confidence: number | null;

  @Column('varchar', { length: 64, nullable: true })
  model: string | null;

  @Column('int', { default: 0, nullable: false })
  promptTokens: number;

  @Column('int', { default: 0, nullable: false })
  outputTokens: number;

  @Column('int', {
    default: 0,
    nullable: false,
    comment: 'micro USD(1e-6). 정수라 SUM() 에 float 누적 오차가 없다',
  })
  estimatedCostMicroUsd: number;

  @Column('int', { default: 0, nullable: false })
  latencyMs: number;

  @Column('varchar', { length: 64, nullable: true })
  finishReason: string | null;

  @Column('varchar', { length: 64, nullable: true })
  errorKind: string | null;

  @Column('varchar', { length: 64, nullable: true })
  traceId: string | null;

  @Column('json', { nullable: true })
  meta: AiConsultLogMetaObject | null;
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  AiConsultDailyStatDto,
  AiConsultUnmatchedQuestionDto,
  SaveAiConsultLogDto,
} from '../dto/ai-consult.dto';
import { AiConsultLogEntity } from '../entity/ai-consult-log.entity';
import { AiConsultAnswerType } from '../enum/ai-consult.enum';

/** FAQ 커버리지가 부족했다는 신호 */
const UNMATCHED_ANSWER_TYPES: readonly AiConsultAnswerType[] = [
  AiConsultAnswerType.FALLBACK,
  AiConsultAnswerType.CONFIRM_SUGGESTION,
];

/**
 * create_date 는 `timestamp without time zone` 이고 값은 DB 기본값
 * `NOW() AT TIME ZONE 'UTC'` 로 채워지므로 **UTC 벽시계**가 저장된다.
 * 반면 JS Date 를 그대로 파라미터로 넘기면 드라이버가 로컬 오프셋으로 직렬화해
 * KST 서버에서는 9시간 어긋난 비교가 되어 조회 결과가 조용히 비어버린다.
 * 그래서 비교값도 UTC 벽시계 문자열로 맞춘다.
 */
function toUtcTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

@Injectable()
export class AiConsultLogRepositoryService {
  constructor(
    @InjectRepository(AiConsultLogEntity)
    private readonly aiConsultLogRepository: Repository<AiConsultLogEntity>,
  ) {}

  /**
   * @Transactional() 을 붙이지 않는다.
   * 로그 적재 실패가 상담 응답을 막으면 안 되므로 호출부에서 fire-and-forget 한다.
   */
  async save(dto: SaveAiConsultLogDto): Promise<void> {
    await this.aiConsultLogRepository.insert(dto);
  }

  /** FAQ 에 없던 질문 목록 — 다음 FAQ 추가 후보를 뽑는 데 쓴다. */
  async findUnmatchedQuestions(
    since: Date,
    limit: number,
  ): Promise<AiConsultUnmatchedQuestionDto[]> {
    const entityList = await this.aiConsultLogRepository
      .createQueryBuilder('log')
      .where('log.createDate >= :since', { since: toUtcTimestamp(since) })
      .andWhere('log.answerType IN (:...answerTypes)', {
        answerTypes: UNMATCHED_ANSWER_TYPES,
      })
      .orderBy('log.createDate', 'DESC')
      .take(limit)
      .getMany();

    return entityList.map((entity) =>
      AiConsultUnmatchedQuestionDto.from(entity),
    );
  }

  /** answerType 별 호출 수와 비용 — 임계값 튜닝과 예산 상향 판단의 근거. */
  async findDailyStats(
    since: Date,
    until: Date,
  ): Promise<AiConsultDailyStatDto[]> {
    const rowList = await this.aiConsultLogRepository
      .createQueryBuilder('log')
      .select('log.answerType', 'answer_type')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(log.estimatedCostMicroUsd)', 'cost')
      .where('log.createDate >= :since', { since: toUtcTimestamp(since) })
      .andWhere('log.createDate < :until', { until: toUtcTimestamp(until) })
      .groupBy('log.answerType')
      .getRawMany();

    return rowList.map((row) => AiConsultDailyStatDto.fromRow(row));
  }
}

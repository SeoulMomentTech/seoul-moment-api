import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { PlanFeedVoteEntity } from '../entity/plan-feed-vote.entity';
import { PlanFeedVoteValue } from '../enum/plan-feed.enum';

@Injectable()
export class PlanFeedVoteRepositoryService {
  constructor(
    @InjectRepository(PlanFeedVoteEntity)
    private readonly planFeedVoteRepository: Repository<PlanFeedVoteEntity>,
  ) {}

  async findOne(
    postId: number,
    planUserId: string,
  ): Promise<PlanFeedVoteEntity | null> {
    return this.planFeedVoteRepository.findOne({
      where: { postId, planUserId },
    });
  }

  async save(entity: PlanFeedVoteEntity): Promise<PlanFeedVoteEntity> {
    return this.planFeedVoteRepository.save(entity);
  }

  async remove(postId: number, planUserId: string): Promise<number> {
    const result = await this.planFeedVoteRepository.delete({
      postId,
      planUserId,
    });
    return result.affected ?? 0;
  }

  /**
   * 목록에 실을 "내가 어떻게 평가했는지".
   *
   * 글마다 따로 물으면 목록 하나에 쿼리가 N 번 나간다. id 를 모아 한 번에
   * 묻고 Map 으로 돌려준다.
   */
  async findMyVotes(
    planUserId: string,
    postIds: number[],
  ): Promise<Map<number, PlanFeedVoteValue>> {
    if (postIds.length === 0) return new Map();

    const rows = await this.planFeedVoteRepository.find({
      where: { planUserId, postId: In(postIds) },
      select: { postId: true, value: true },
    });

    return new Map(rows.map((row) => [row.postId, row.value]));
  }

  /** 내가 올린 글들이 받은 "도움이 돼요" 총합 */
  async countHelpfulForPostIds(postIds: number[]): Promise<number> {
    if (postIds.length === 0) return 0;
    return this.planFeedVoteRepository.count({
      where: { postId: In(postIds), value: PlanFeedVoteValue.HELPFUL },
    });
  }
}

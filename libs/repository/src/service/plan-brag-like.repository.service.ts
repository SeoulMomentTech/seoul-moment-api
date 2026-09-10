import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { PlanBragLikeEntity } from '../entity/plan-brag-like.entity';

@Injectable()
export class PlanBragLikeRepositoryService {
  constructor(
    @InjectRepository(PlanBragLikeEntity)
    private readonly planBragLikeRepository: Repository<PlanBragLikeEntity>,
  ) {}

  async findOne(
    bragId: number,
    planUserId: string,
  ): Promise<PlanBragLikeEntity | null> {
    return this.planBragLikeRepository.findOne({
      where: { bragId, planUserId },
    });
  }

  async save(entity: PlanBragLikeEntity): Promise<PlanBragLikeEntity> {
    return this.planBragLikeRepository.save(entity);
  }

  async remove(bragId: number, planUserId: string): Promise<number> {
    const result = await this.planBragLikeRepository.delete({
      bragId,
      planUserId,
    });
    return result.affected ?? 0;
  }

  /**
   * 목록에 실을 "내가 눌렀는지".
   *
   * 카드마다 따로 물으면 목록 하나에 쿼리가 N 번 나간다. id 를 모아 한 번에
   * 묻고 Set 으로 돌려준다 (plan-feed-vote 의 findMyVotes 와 같은 처리).
   */
  async findMyLikedIds(
    planUserId: string,
    bragIds: number[],
  ): Promise<Set<number>> {
    if (bragIds.length === 0) return new Set();

    const rows = await this.planBragLikeRepository.find({
      where: { planUserId, bragId: In(bragIds) },
      select: { bragId: true },
    });

    return new Set(rows.map((row) => row.bragId));
  }
}

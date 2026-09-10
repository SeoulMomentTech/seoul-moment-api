import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { PlanBragEntity } from '../entity/plan-brag.entity';
import { PlanBragSort, PlanBragStatus } from '../enum/plan-brag.enum';

export interface FindPlanBragListOptions {
  sort: PlanBragSort;
  page: number;
  count: number;
}

/**
 * 좋아요순은 like_count 컬럼으로 센다. 피드의 도움순처럼 뺄셈이 필요 없어서
 * (여기는 반대표가 없다) 컬럼 하나로 충분하다.
 */
function applySort(
  qb: SelectQueryBuilder<PlanBragEntity>,
  sort: PlanBragSort,
): void {
  if (sort === PlanBragSort.LIKED) {
    qb.orderBy('brag.like_count', 'DESC').addOrderBy(
      'brag.published_at',
      'DESC',
    );
  } else {
    qb.orderBy('brag.published_at', 'DESC');
  }
  // 같은 값끼리 순서가 요청마다 뒤집히면 "더 보기" 에서 같은 글이 두 번 온다
  qb.addOrderBy('brag.id', 'DESC');
}

@Injectable()
export class PlanBragRepositoryService {
  constructor(
    @InjectRepository(PlanBragEntity)
    private readonly planBragRepository: Repository<PlanBragEntity>,
  ) {}

  async save(entity: PlanBragEntity): Promise<PlanBragEntity> {
    return this.planBragRepository.save(entity);
  }

  /** 공개된 것만. 내려간 글은 링크를 알아도 못 본다 */
  async findPublishedById(id: number): Promise<PlanBragEntity | null> {
    return this.planBragRepository.findOne({
      where: { id, status: PlanBragStatus.PUBLISHED },
    });
  }

  /**
   * 내 브래그. **상태와 무관하게** 찾는다.
   *
   * 내렸다 다시 올릴 때 같은 행을 되살려야 좋아요가 이어진다. 여기서
   * PUBLISHED 만 찾으면 올릴 때마다 새 행을 만들게 되고, 그러면 유니크
   * 인덱스에 걸리거나(걸리는 게 맞다) 좋아요가 사라진다.
   */
  async findByPlanUserId(planUserId: string): Promise<PlanBragEntity | null> {
    return this.planBragRepository.findOne({ where: { planUserId } });
  }

  async findAndCountPublished(
    options: FindPlanBragListOptions,
  ): Promise<[PlanBragEntity[], number]> {
    const qb = this.planBragRepository
      .createQueryBuilder('brag')
      .where('brag.status = :status', { status: PlanBragStatus.PUBLISHED });

    applySort(qb, options.sort);

    return qb
      .skip((options.page - 1) * options.count)
      .take(options.count)
      .getManyAndCount();
  }

  /**
   * 좋아요 수를 원자적으로 올리고 내린다.
   *
   * 읽고-더하고-쓰면 동시에 누른 두 사람 중 하나가 사라진다. 갱신은 DB 에
   * 맡기고, 0 아래로는 내려가지 않게 막는다.
   */
  async addLikeCount(id: number, delta: number): Promise<void> {
    await this.planBragRepository
      .createQueryBuilder()
      .update(PlanBragEntity)
      .set({
        likeCount: () =>
          delta >= 0
            ? `like_count + ${delta}`
            : `GREATEST(like_count - ${Math.abs(delta)}, 0)`,
      })
      .where('id = :id', { id })
      .execute();
  }

  /** 갱신 뒤의 최종 수. 낙관적으로 그린 앱이 여기 값으로 맞춘다 */
  async getLikeCount(id: number): Promise<number> {
    const row = await this.planBragRepository.findOne({
      where: { id },
      select: { likeCount: true },
    });
    return row?.likeCount ?? 0;
  }
}

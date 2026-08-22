import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository, SelectQueryBuilder } from 'typeorm';

import { PlanFeedPostEntity } from '../entity/plan-feed-post.entity';
import { PlanFeedPostStatus, PlanFeedSort } from '../enum/plan-feed.enum';

export interface FindPlanFeedListOptions {
  categoryName?: string;
  region?: string;
  minAmount?: number;
  maxAmount?: number;
  sort: PlanFeedSort;
  page: number;
  count: number;
}

/**
 * 도움순은 `도움이 돼요 - 도움이 안 돼요` 로 센다. 돼요만 세면 쓸모없는
 * 후기도 노출만 많으면 위로 올라온다 — 아래로 밀어내는 게 이 투표의
 * 존재 이유다. 점수를 컬럼으로 들고 있으면 카운터가 셋이 되어 어긋날
 * 자리가 늘어나므로 식으로 정렬한다.
 */
function applySort(
  qb: SelectQueryBuilder<PlanFeedPostEntity>,
  sort: PlanFeedSort,
): void {
  switch (sort) {
    case PlanFeedSort.HELPFUL:
      qb.orderBy('post.helpful_count - post.not_helpful_count', 'DESC');
      break;
    case PlanFeedSort.AMOUNT_ASC:
      qb.orderBy('post.amount', 'ASC');
      break;
    case PlanFeedSort.AMOUNT_DESC:
      qb.orderBy('post.amount', 'DESC');
      break;
    default:
      qb.orderBy('post.create_date', 'DESC');
      break;
  }
  // 같은 값끼리 순서가 요청마다 뒤집히면 더 보기에서 같은 글이 두 번 온다
  qb.addOrderBy('post.id', 'DESC');
}

@Injectable()
export class PlanFeedRepositoryService {
  constructor(
    @InjectRepository(PlanFeedPostEntity)
    private readonly planFeedPostRepository: Repository<PlanFeedPostEntity>,
  ) {}

  async save(entity: PlanFeedPostEntity): Promise<PlanFeedPostEntity> {
    return this.planFeedPostRepository.save(entity);
  }

  async findById(id: number): Promise<PlanFeedPostEntity | null> {
    return this.planFeedPostRepository.findOne({
      where: { id, status: Not(PlanFeedPostStatus.DELETE) },
    });
  }

  /** 같은 일정을 두 번 올렸는지 본다. 지운 글은 다시 올릴 수 있게 뺀다 */
  async findBySourceScheduleId(
    planUserId: string,
    sourceScheduleId: number,
  ): Promise<PlanFeedPostEntity | null> {
    return this.planFeedPostRepository.findOne({
      where: {
        planUserId,
        sourceScheduleId,
        status: Not(PlanFeedPostStatus.DELETE),
      },
    });
  }

  /**
   * 공개된 후기 목록.
   *
   * 금액 조건은 **공개한 글에만** 걸 수 있다. 비공개 금액까지 범위에 넣으면
   * 목록에 들어왔다 나갔다 하는 것만으로 값이 새어 나간다.
   */
  async findAndCountPublished(
    options: FindPlanFeedListOptions,
  ): Promise<[PlanFeedPostEntity[], number]> {
    const qb = this.planFeedPostRepository
      .createQueryBuilder('post')
      .where('post.status = :status', {
        status: PlanFeedPostStatus.PUBLISHED,
      });

    if (options.categoryName) {
      qb.andWhere('post.category_name = :category', {
        category: options.categoryName,
      });
    }
    if (options.region) {
      qb.andWhere('post.region LIKE :region', {
        region: `${options.region}%`,
      });
    }

    const { minAmount, maxAmount } = options;
    if (minAmount !== undefined || maxAmount !== undefined) {
      qb.andWhere('post.is_amount_public = true');
      if (minAmount !== undefined) {
        qb.andWhere('post.amount >= :minAmount', { minAmount });
      }
      if (maxAmount !== undefined) {
        qb.andWhere('post.amount <= :maxAmount', { maxAmount });
      }
    }

    applySort(qb, options.sort);

    return qb
      .skip((options.page - 1) * options.count)
      .take(options.count)
      .getManyAndCount();
  }

  async findAndCountByPlanUserId(
    planUserId: string,
    page: number,
    count: number,
  ): Promise<[PlanFeedPostEntity[], number]> {
    return this.planFeedPostRepository.findAndCount({
      where: { planUserId, status: Not(PlanFeedPostStatus.DELETE) },
      order: { createDate: 'DESC', id: 'DESC' },
      skip: (page - 1) * count,
      take: count,
    });
  }

  /** 이미 후기를 올린 일정 id 들. "올릴 수 있는 일정"을 추릴 때 쓴다 */
  async findPostedScheduleIds(
    planUserId: string,
    scheduleIds: number[],
  ): Promise<number[]> {
    if (scheduleIds.length === 0) return [];

    const rows = await this.planFeedPostRepository.find({
      where: {
        planUserId,
        sourceScheduleId: In(scheduleIds),
        status: Not(PlanFeedPostStatus.DELETE),
      },
      select: { sourceScheduleId: true },
    });

    return rows
      .map((row) => row.sourceScheduleId)
      .filter((id): id is number => id !== null);
  }

  /**
   * 카테고리별 시세.
   *
   * **평균이 아니라 중앙값과 사분위수**를 준다. 자기 신고 금액이라 단위를
   * 잘못 적은 한 건이 평균을 통째로 흔든다. "가운데 절반이 300~450만원"
   * 이 "평균 372만원" 보다 정직하고 실제로 더 쓸모 있다.
   *
   * 표본 수(total)를 함께 주는 이유는 부르는 쪽이 **적으면 안 보여주기
   * 위해서**다. 3개로 시세를 말하는 건 조작보다 더 큰 거짓말이다.
   */
  async findCategoryStats(): Promise<
    Array<{
      categoryName: string;
      total: number;
      median: number;
      p25: number;
      p75: number;
    }>
  > {
    const rows = await this.planFeedPostRepository
      .createQueryBuilder('post')
      .select('post.category_name', 'categoryName')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        'percentile_cont(0.5) WITHIN GROUP (ORDER BY post.amount)',
        'median',
      )
      .addSelect(
        'percentile_cont(0.25) WITHIN GROUP (ORDER BY post.amount)',
        'p25',
      )
      .addSelect(
        'percentile_cont(0.75) WITHIN GROUP (ORDER BY post.amount)',
        'p75',
      )
      .where('post.status = :status', {
        status: PlanFeedPostStatus.PUBLISHED,
      })
      .andWhere('post.is_amount_public = true')
      .andWhere('post.amount IS NOT NULL')
      .groupBy('post.category_name')
      .getRawMany<{
        categoryName: string;
        total: string;
        median: string;
        p25: string;
        p75: string;
      }>();

    return rows.map((row) => ({
      categoryName: row.categoryName,
      total: Number(row.total),
      median: Math.round(Number(row.median)),
      p25: Math.round(Number(row.p25)),
      p75: Math.round(Number(row.p75)),
    }));
  }

  async increaseCounts(
    id: number,
    helpfulDelta: number,
    notHelpfulDelta: number,
  ): Promise<void> {
    if (helpfulDelta !== 0) {
      await this.planFeedPostRepository.increment(
        { id },
        'helpfulCount',
        helpfulDelta,
      );
    }
    if (notHelpfulDelta !== 0) {
      await this.planFeedPostRepository.increment(
        { id },
        'notHelpfulCount',
        notHelpfulDelta,
      );
    }
  }
}

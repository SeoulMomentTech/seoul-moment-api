import { DatabaseSort } from '@app/common/enum/global.enum';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { PlanBragLikeEntity } from '@app/repository/entity/plan-brag-like.entity';
import {
  PlanBragCategorySnapshot,
  PlanBragEntity,
  PlanBragItemSnapshot,
} from '@app/repository/entity/plan-brag.entity';
import { PlanScheduleEntity } from '@app/repository/entity/plan-schedule.entity';
import { PlanUserEntity } from '@app/repository/entity/plan-user.entity';
import {
  PlanBragSort,
  PlanBragStatus,
} from '@app/repository/enum/plan-brag.enum';
import {
  PlanScheduleSortColumn,
  PlanScheduleStatus,
} from '@app/repository/enum/plan-schedule.enum';
import { PlanBragLikeRepositoryService } from '@app/repository/service/plan-brag-like.repository.service';
import { PlanBragRepositoryService } from '@app/repository/service/plan-brag.repository.service';
import { PlanScheduleRepositoryService } from '@app/repository/service/plan-schedule.repository.service';
import { PlanUserRoomMemberRepositoryService } from '@app/repository/service/plan-user--room-member.repository.service';
import { PlanUserRoomRepositoryService } from '@app/repository/service/plan-user-room.repository.service';
import { PlanUserRepositoryService } from '@app/repository/service/plan-user.repository.service';
import { Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';

import {
  GetPlanBragDetailResponse,
  GetPlanBragListRequest,
  GetPlanBragMyStatusResponse,
  GetPlanBragResponse,
  PlanBragLikeResponse,
} from './plan-brag.dto';
import { coupleNickname, toDateString } from './plan-brag.util';

/**
 * 스냅샷을 뜰 때 훑는 일정 상한.
 *
 * 플랜 보드가 `count=10000` 으로 전부 받는 것과 같은 자리다. 여기서 잘리면
 * 자랑하기에 보이는 플랜 수가 실제와 달라지므로 넉넉히 잡는다.
 */
const SNAPSHOT_SCAN_COUNT = 10000;

/** 목록 카드에 붙는 칩 개수. 그 이상은 카드가 두 줄이 되어 벽돌이 흐트러진다 */
const CARD_CATEGORY_COUNT = 5;

@Injectable()
export class PlanBragService {
  constructor(
    private readonly planBragRepositoryService: PlanBragRepositoryService,
    private readonly planBragLikeRepositoryService: PlanBragLikeRepositoryService,
    private readonly planScheduleRepositoryService: PlanScheduleRepositoryService,
    private readonly planUserRepositoryService: PlanUserRepositoryService,
    private readonly planUserRoomRepositoryService: PlanUserRoomRepositoryService,
    private readonly planUserRoomMemberRepositoryService: PlanUserRoomMemberRepositoryService,
  ) {}

  async getPlanBragList(
    viewerPlanUserId: string,
    query: GetPlanBragListRequest,
  ): Promise<[GetPlanBragResponse[], number]> {
    const [entities, total] =
      await this.planBragRepositoryService.findAndCountPublished({
        sort: query.sort ?? PlanBragSort.RECENT,
        page: query.page ?? 1,
        count: query.count ?? 20,
      });

    const likedIds = await this.planBragLikeRepositoryService.findMyLikedIds(
      viewerPlanUserId,
      entities.map((entity) => entity.id),
    );

    return [
      entities.map((entity) =>
        GetPlanBragResponse.from(entity, viewerPlanUserId, likedIds),
      ),
      total,
    ];
  }

  /**
   * 상세.
   *
   * **내 것이 아니어도 누구나 본다** — 자랑하기의 목적이 그거다. 대신 내려간
   * 글은 404 다. 링크를 알아도 못 본다.
   */
  async getPlanBragDetail(
    viewerPlanUserId: string,
    bragId: number,
  ): Promise<GetPlanBragDetailResponse> {
    const entity =
      await this.planBragRepositoryService.findPublishedById(bragId);

    if (!entity) {
      throw new ServiceError(
        'Plan brag not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    const likedIds = await this.planBragLikeRepositoryService.findMyLikedIds(
      viewerPlanUserId,
      [entity.id],
    );

    return GetPlanBragDetailResponse.fromDetail(
      entity,
      viewerPlanUserId,
      likedIds,
    );
  }

  async getMyStatus(planUserId: string): Promise<GetPlanBragMyStatusResponse> {
    return GetPlanBragMyStatusResponse.from(
      await this.planBragRepositoryService.findByPlanUserId(planUserId),
    );
  }

  /**
   * 자랑하기에 올린다. 지금 내 플랜의 **스냅샷을 뜬다.**
   *
   * **이미 올라가 있으면 아무것도 하지 않는다.** 앱이 "올린 뒤에는 고칠 수
   * 없어요. 고치려면 내렸다가 다시 올려요" 라고 약속했는데, 여기서 다시
   * 스냅샷을 뜨면 켠 채로 예산을 고쳐도 남의 화면이 따라 바뀐다 — 약속이
   * 조용히 깨진다.
   *
   * 내려가 있던 것을 다시 올리면 **행을 그대로 쓰고 스냅샷만 새로 뜬다.**
   * 그래서 좋아요가 이어진다.
   */
  @Transactional()
  async publish(planUserId: string): Promise<number> {
    const existing =
      await this.planBragRepositoryService.findByPlanUserId(planUserId);

    if (existing?.status === PlanBragStatus.PUBLISHED) {
      return existing.id;
    }
    // 운영자가 내린 글은 본인이 되살리지 못한다
    if (existing?.status === PlanBragStatus.HIDDEN) {
      throw new ServiceError(
        'Plan brag is hidden by operator',
        ServiceErrorCode.FORBIDDEN,
      );
    }

    const { user, nickname } = await this.requirePublishable(planUserId);
    const snapshot = await this.buildSnapshot(planUserId);

    const entity = existing ?? new PlanBragEntity();
    entity.planUserId = planUserId;
    entity.nickname = nickname;
    entity.weddingDate = user.weddingDate;
    entity.totalBudget = user.budget;
    entity.usedAmount = snapshot.usedAmount;
    entity.plannedAmount = snapshot.plannedAmount;
    entity.planCount = snapshot.planCount;
    entity.doneCount = snapshot.doneCount;
    entity.categories = snapshot.categories;
    entity.categoryChart = snapshot.categoryChart;
    entity.items = snapshot.items;
    entity.status = PlanBragStatus.PUBLISHED;
    entity.publishedAt = new Date();
    // likeCount 는 건드리지 않는다 — 다시 올릴 때 이어받는 값이다

    const saved = await this.planBragRepositoryService.save(entity);
    return saved.id;
  }

  /**
   * 올릴 수 있는 상태인지.
   *
   * **온보딩을 마치지 않은 사람은 자랑할 내용이 없다.** 이름이 비면 카드에
   * 부를 이름이 없고, 날짜·예산이 비면 카드의 두 줄이 통째로 빈다.
   */
  private async requirePublishable(
    planUserId: string,
  ): Promise<{ user: PlanUserEntity; nickname: string }> {
    const user = await this.planUserRepositoryService.getById(planUserId);
    const nickname = await this.buildNickname(planUserId, user.name);

    if (!nickname || !user.weddingDate || !user.budget) {
      throw new ServiceError(
        'Plan is not ready to publish',
        ServiceErrorCode.BAD_REQUEST,
      );
    }

    return { user, nickname };
  }

  /**
   * 내린다.
   *
   * **행을 지우지 않는다.** 상태만 내려 두면 다시 올릴 때 좋아요가 이어진다 —
   * 지운 뒤에는 그게 소급이 안 된다.
   */
  async unpublish(planUserId: string): Promise<void> {
    const entity =
      await this.planBragRepositoryService.findByPlanUserId(planUserId);

    if (!entity || entity.status !== PlanBragStatus.PUBLISHED) return;

    entity.status = PlanBragStatus.UNPUBLISHED;
    entity.publishedAt = null;
    await this.planBragRepositoryService.save(entity);
  }

  /**
   * 좋아요. 한 사람이 한 번이고, 같은 요청을 두 번 보내도 수가 늘지 않는다.
   *
   * 행과 카운터를 **같은 트랜잭션**에서 쓴다. 따로 쓰면 하나만 반영된 채로
   * 남아 목록의 숫자와 실제 누른 사람 수가 영영 어긋난다.
   */
  @Transactional()
  async like(
    planUserId: string,
    bragId: number,
  ): Promise<PlanBragLikeResponse> {
    const brag = await this.requireLikableBrag(planUserId, bragId);

    const existing = await this.planBragLikeRepositoryService.findOne(
      brag.id,
      planUserId,
    );

    if (!existing) {
      const entity = new PlanBragLikeEntity();
      entity.bragId = brag.id;
      entity.planUserId = planUserId;
      await this.planBragLikeRepositoryService.save(entity);
      await this.planBragRepositoryService.addLikeCount(brag.id, 1);
    }

    return {
      likeCount: await this.planBragRepositoryService.getLikeCount(brag.id),
      liked: true,
    };
  }

  @Transactional()
  async cancelLike(
    planUserId: string,
    bragId: number,
  ): Promise<PlanBragLikeResponse> {
    const brag = await this.requireLikableBrag(planUserId, bragId);

    const removed = await this.planBragLikeRepositoryService.remove(
      brag.id,
      planUserId,
    );
    if (removed > 0) {
      await this.planBragRepositoryService.addLikeCount(brag.id, -1);
    }

    return {
      likeCount: await this.planBragRepositoryService.getLikeCount(brag.id),
      liked: false,
    };
  }

  /**
   * **자기 것에는 못 누른다.** 앱도 버튼을 내지 않지만 서버에서도 막는다 —
   * 화면만 막으면 요청 한 번으로 자기 수를 올릴 수 있다.
   */
  private async requireLikableBrag(
    planUserId: string,
    bragId: number,
  ): Promise<PlanBragEntity> {
    const brag = await this.planBragRepositoryService.findPublishedById(bragId);

    if (!brag) {
      throw new ServiceError(
        'Plan brag not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }
    if (brag.planUserId === planUserId) {
      throw new ServiceError(
        'Cannot like own brag',
        ServiceErrorCode.FORBIDDEN,
      );
    }
    return brag;
  }

  /** "지수 · 현우". 배우자가 없으면 내 이름 하나다 */
  private async buildNickname(
    planUserId: string,
    ownerName: string,
  ): Promise<string> {
    const room =
      await this.planUserRoomRepositoryService.findByOwnerId(planUserId);
    if (!room) return coupleNickname({ name: ownerName });

    const spouse =
      await this.planUserRoomMemberRepositoryService.findSpouseByRoomId(
        room.id,
      );
    if (!spouse) return coupleNickname({ name: ownerName });

    const spouseUser = await this.planUserRepositoryService.findById(
      spouse.planUserId,
    );
    return coupleNickname({ name: ownerName }, spouseUser);
  }

  /**
   * 지금 내 플랜을 그대로 복사한다.
   *
   * 금액은 전부 **만원 단위**로, 앱의 다른 화면과 같다. 지출은 완료한
   * 일정만, 예정은 아직 완료하지 않은 일정만 센다 — 홈 예산 막대의
   * 분홍/회색과 뜻이 같아야 한다.
   */
  private async buildSnapshot(planUserId: string): Promise<{
    usedAmount: number;
    plannedAmount: number;
    planCount: number;
    doneCount: number;
    categories: string[];
    categoryChart: PlanBragCategorySnapshot[];
    items: PlanBragItemSnapshot[];
  }> {
    const [schedules] = await this.planScheduleRepositoryService.getList(
      1,
      SNAPSHOT_SCAN_COUNT,
      planUserId,
      undefined,
      undefined,
      undefined,
      PlanScheduleSortColumn.START_DATE,
      DatabaseSort.DESC,
    );

    const totals = this.sumSchedules(schedules);
    const categoryChart = this.toCategoryChart(totals.usedByCategory);

    return {
      usedAmount: totals.usedAmount,
      plannedAmount: totals.plannedAmount,
      planCount: schedules.length,
      doneCount: totals.doneCount,
      categories: categoryChart
        .slice(0, CARD_CATEGORY_COUNT)
        .map((row) => row.categoryName),
      categoryChart,
      items: schedules.map((schedule) => this.toItemSnapshot(schedule)),
    };
  }

  /**
   * 지출·예정·완료 개수를 한 번에 센다.
   *
   * 지출은 **완료한 일정만**, 예정은 아직 완료하지 않은 일정만이다 — 홈
   * 예산 막대의 분홍/회색과 뜻이 같아야 한다.
   */
  private sumSchedules(schedules: PlanScheduleEntity[]): {
    usedAmount: number;
    plannedAmount: number;
    doneCount: number;
    usedByCategory: Map<string, number>;
  } {
    let usedAmount = 0;
    let plannedAmount = 0;
    let doneCount = 0;
    const usedByCategory = new Map<string, number>();

    for (const schedule of schedules) {
      const amount = schedule.amount ?? 0;

      if (schedule.status === PlanScheduleStatus.COMPLETED) {
        usedAmount += amount;
        doneCount += 1;
        usedByCategory.set(
          schedule.categoryName,
          (usedByCategory.get(schedule.categoryName) ?? 0) + amount,
        );
      } else {
        plannedAmount += amount;
      }
    }

    return { usedAmount, plannedAmount, doneCount, usedByCategory };
  }

  /**
   * 막대·범례는 **지출 큰 순**이다.
   *
   * 앱이 상위 4개에만 색을 주고 나머지는 무채색으로 떨어뜨리므로, 순서가
   * 뒤집히면 같은 카테고리의 색이 매번 바뀐다. 아직 한 푼도 안 쓴
   * 카테고리는 막대에 낼 것이 없어 뺀다.
   */
  private toCategoryChart(
    usedByCategory: Map<string, number>,
  ): PlanBragCategorySnapshot[] {
    return [...usedByCategory]
      .filter(([, amount]) => amount > 0)
      .map(([categoryName, amount]) => ({ categoryName, usedAmount: amount }))
      .sort((a, b) => b.usedAmount - a.usedAmount);
  }

  /**
   * 일정 한 줄을 스냅샷으로.
   *
   * **시각(startTime)과 장소(location)·메모는 담지 않는다.** 안내 모달이
   * 약속한 공개 범위 밖이고, 장소는 카카오에서 고르면 업체명이 그대로
   * 들어가는 자리라 공개 범위가 조용히 넓어진다.
   */
  private toItemSnapshot(schedule: PlanScheduleEntity): PlanBragItemSnapshot {
    return {
      id: schedule.id,
      categoryName: schedule.categoryName,
      title: schedule.title,
      amount: schedule.amount ?? null,
      startDate: toDateString(schedule.startDate),
      status: schedule.status,
    };
  }
}

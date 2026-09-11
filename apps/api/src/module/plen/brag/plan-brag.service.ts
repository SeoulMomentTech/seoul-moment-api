import { DatabaseSort } from '@app/common/enum/global.enum';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { PlanBragLikeEntity } from '@app/repository/entity/plan-brag-like.entity';
import { PlanBragEntity } from '@app/repository/entity/plan-brag.entity';
import { PlanScheduleEntity } from '@app/repository/entity/plan-schedule.entity';
import { PlanUserEntity } from '@app/repository/entity/plan-user.entity';
import {
  PlanBragSort,
  PlanBragStatus,
} from '@app/repository/enum/plan-brag.enum';
import {
  PlanScheduleSortColumn,
  PlanScheduleStatus,
  isSchedulePaid,
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
  PlanBragCategoryView,
  PlanBragItemView,
  PlanBragLikeResponse,
  PlanBragLiveFacts,
} from './plan-brag.dto';
import { coupleNickname, toDateString } from './plan-brag.util';

/**
 * 상세에서 훑는 일정 상한.
 *
 * 플랜 보드가 `count=10000` 으로 전부 받는 것과 같은 자리다. 여기서 잘리면
 * 자랑하기에 보이는 플랜 수가 실제와 달라지므로 넉넉히 잡는다.
 */
const ITEM_SCAN_COUNT = 10000;

/**
 * 자랑하기.
 *
 * **`plan_brag` 에는 "올렸다" 는 사실만 있다.** 예산·개수·카테고리·플랜
 * 목록은 저장하지 않고, 볼 때마다 그 사람의 지금 플랜에서 새로 만든다 —
 * 켜 둔 뒤에 일정을 고치거나 장소를 더하면 자랑하기도 같이 바뀌어야 한다.
 *
 * 처음에는 올리는 순간의 스냅샷을 복사해 뒀는데 틀렸다. "수정하지 못하고 볼
 * 수만 있다" 는 **보는 사람** 이야기이지 올린 사람 이야기가 아니다.
 */
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

    if (entities.length === 0) return [[], total];

    const planUserIds = entities.map((entity) => entity.planUserId);
    const [factsById, likedIds] = await Promise.all([
      this.buildFacts(planUserIds),
      this.planBragLikeRepositoryService.findMyLikedIds(
        viewerPlanUserId,
        entities.map((entity) => entity.id),
      ),
    ]);

    return [
      entities
        .map((entity) => {
          const facts = factsById.get(entity.planUserId);
          if (!facts) return null;
          return GetPlanBragResponse.from(
            entity,
            facts,
            viewerPlanUserId,
            likedIds,
          );
        })
        .filter((row): row is GetPlanBragResponse => row !== null),
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

    const [factsById, likedIds, items] = await Promise.all([
      this.buildFacts([entity.planUserId]),
      this.planBragLikeRepositoryService.findMyLikedIds(viewerPlanUserId, [
        entity.id,
      ]),
      this.loadItems(entity.planUserId),
    ]);

    const facts = factsById.get(entity.planUserId);
    if (!facts) {
      throw new ServiceError(
        'Plan brag owner not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return GetPlanBragDetailResponse.fromDetail(
      entity,
      facts,
      items,
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
   * 자랑하기에 올린다.
   *
   * **스냅샷을 뜨지 않는다.** 켜 두는 동안 내 플랜이 그대로 보인다 — 일정을
   * 더하거나 장소를 붙이면 자랑하기도 같이 바뀐다.
   *
   * 이미 올라가 있으면 아무것도 하지 않는다(멱등). 내려가 있던 것을 다시
   * 올리면 같은 행을 쓰므로 좋아요가 이어진다.
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

    await this.requirePublishable(planUserId);

    const entity = existing ?? new PlanBragEntity();
    entity.planUserId = planUserId;
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
  private async requirePublishable(planUserId: string): Promise<void> {
    const user = await this.planUserRepositoryService.getById(planUserId);
    const nickname = await this.buildNickname(planUserId, user.name);

    if (!nickname || !user.weddingDate || !user.budget) {
      throw new ServiceError(
        'Plan is not ready to publish',
        ServiceErrorCode.BAD_REQUEST,
      );
    }
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

  /**
   * 지금 플랜에서 카드에 필요한 값을 만든다. **여러 사람 것을 한 번에.**
   *
   * 목록 한 장이 20명이라, 사람마다 따로 물으면 쿼리가 20번씩 나간다.
   * 사용자·배우자·집계를 각각 한 번씩만 묻고 사람별로 접는다.
   */
  private async buildFacts(
    planUserIds: string[],
  ): Promise<Map<string, PlanBragLiveFacts>> {
    const unique = [...new Set(planUserIds)];
    const [users, nicknames, totals] = await Promise.all([
      this.planUserRepositoryService.findByIds(unique),
      this.buildNicknames(unique),
      this.planScheduleRepositoryService.getBragTotals(unique),
    ]);

    const byUser = new Map<string, PlanUserEntity>(
      users.map((user) => [user.id, user]),
    );
    const rowsByUser = new Map<string, typeof totals>();
    totals.forEach((row) => {
      const list = rowsByUser.get(row.planUserId) ?? [];
      list.push(row);
      rowsByUser.set(row.planUserId, list);
    });

    const result = new Map<string, PlanBragLiveFacts>();
    unique.forEach((id) => {
      const user = byUser.get(id);
      if (!user) return;
      result.set(
        id,
        this.foldFacts(
          user,
          nicknames.get(id) ?? coupleNickname({ name: user.name }),
          rowsByUser.get(id) ?? [],
        ),
      );
    });

    return result;
  }

  /** 한 사람의 집계 줄들을 카드 한 장의 값으로 접는다 */
  private foldFacts(
    user: PlanUserEntity,
    nickname: string,
    rows: Array<{
      categoryName: string;
      usedAmount: number;
      plannedAmount: number;
      total: number;
      done: number;
    }>,
  ): PlanBragLiveFacts {
    /*
      막대·범례는 **지출 큰 순**이다. 앱이 상위 4개에만 색을 주고 나머지는
      "그 외" 로 합치므로, 순서가 뒤집히면 같은 카테고리의 색이 매번 바뀐다.
      아직 한 푼도 안 쓴 카테고리는 막대에 낼 것이 없어 뺀다.
    */
    const categoryChart: PlanBragCategoryView[] = rows
      .filter((row) => row.usedAmount > 0)
      .map((row) => ({
        categoryName: row.categoryName,
        usedAmount: row.usedAmount,
      }))
      .sort((a, b) => b.usedAmount - a.usedAmount);

    return {
      nickname,
      weddingDate: user.weddingDate ?? null,
      totalBudget: user.budget ?? 0,
      usedAmount: rows.reduce((n, row) => n + row.usedAmount, 0),
      plannedAmount: rows.reduce((n, row) => n + row.plannedAmount, 0),
      planCount: rows.reduce((n, row) => n + row.total, 0),
      doneCount: rows.reduce((n, row) => n + row.done, 0),
      categoryChart,
    };
  }

  /** 상세에 실을 플랜 목록. 최신순 */
  private async loadItems(planUserId: string): Promise<PlanBragItemView[]> {
    const [schedules] = await this.planScheduleRepositoryService.getList(
      1,
      ITEM_SCAN_COUNT,
      planUserId,
      undefined,
      undefined,
      undefined,
      PlanScheduleSortColumn.START_DATE,
      DatabaseSort.DESC,
    );

    return schedules
      .filter((schedule) => schedule.status !== PlanScheduleStatus.DELETE)
      .map((schedule) => this.toItemView(schedule));
  }

  /**
   * 일정 한 줄을 응답으로.
   *
   * **시각(startTime)과 메모(memo)는 담지 않는다.** 안내 모달이 약속한
   * 공개 범위 밖이다.
   *
   * 장소는 담는다 — 상세 시트가 지도를 보여 준다. `decimal` 은 드라이버가
   * **문자열로** 주므로 반드시 Number 로 바꾼다. 그대로 JSON 에 넣으면 앱이
   * `new kakao.maps.LatLng("37.5")` 를 부르고 지도가 안 뜬다.
   */
  private toItemView(schedule: PlanScheduleEntity): PlanBragItemView {
    const num = (v: number | string | null | undefined) =>
      v === null || v === undefined || v === '' ? null : Number(v);

    return {
      id: schedule.id,
      categoryName: schedule.categoryName,
      title: schedule.title,
      amount: schedule.amount ?? null,
      startDate: toDateString(schedule.startDate),
      status: schedule.status,
      isPaid: isSchedulePaid(schedule),
      location: schedule.location?.trim() || null,
      lat: num(schedule.locationLat),
      lng: num(schedule.locationLng),
    };
  }

  /** "지수 · 현우". 배우자가 없으면 내 이름 하나다 */
  private async buildNickname(
    planUserId: string,
    ownerName: string,
  ): Promise<string> {
    return (
      (await this.buildNicknames([planUserId])).get(planUserId) ??
      coupleNickname({ name: ownerName })
    );
  }

  /** 여러 사람의 이름을 한 번에. 목록에서 사람마다 방을 묻지 않으려고 */
  private async buildNicknames(
    planUserIds: string[],
  ): Promise<Map<string, string>> {
    const users = await this.planUserRepositoryService.findByIds(planUserIds);
    const nameById = new Map(users.map((user) => [user.id, user.name]));
    const result = new Map<string, string>();

    await Promise.all(
      planUserIds.map(async (id) => {
        const ownerName = nameById.get(id) ?? '';
        const room = await this.planUserRoomRepositoryService.findByOwnerId(id);
        const spouse = room
          ? await this.planUserRoomMemberRepositoryService.findSpouseByRoomId(
              room.id,
            )
          : null;
        const spouseUser = spouse
          ? await this.planUserRepositoryService.findById(spouse.planUserId)
          : null;
        result.set(id, coupleNickname({ name: ownerName }, spouseUser));
      }),
    );

    return result;
  }
}

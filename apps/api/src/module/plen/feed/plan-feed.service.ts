import { DatabaseSort } from '@app/common/enum/global.enum';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { PlanFeedPostEntity } from '@app/repository/entity/plan-feed-post.entity';
import { PlanFeedVoteEntity } from '@app/repository/entity/plan-feed-vote.entity';
import {
  PlanFeedAuthorRole,
  PlanFeedPostStatus,
  PlanFeedSort,
  PlanFeedVoteValue,
} from '@app/repository/enum/plan-feed.enum';
import {
  PlanScheduleSortColumn,
  PlanScheduleStatus,
} from '@app/repository/enum/plan-schedule.enum';
import { PlanFeedVoteRepositoryService } from '@app/repository/service/plan-feed-vote.repository.service';
import { PlanFeedRepositoryService } from '@app/repository/service/plan-feed.repository.service';
import { PlanScheduleRepositoryService } from '@app/repository/service/plan-schedule.repository.service';
import { PlanUserRepositoryService } from '@app/repository/service/plan-user.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  GetPlanFeedListRequest,
  GetPlanFeedMyStatusResponse,
  GetPlanFeedResponse,
  GetPostableScheduleResponse,
  PlanFeedVoteResponse,
  PostPlanFeedRequest,
} from './plan-feed.dto';
import { daysUntilWedding, toRegion } from './plan-feed.util';

/** 사이드 패널이 훑는 완료 일정 상한. 전부 세지 않고 최근 것만 본다 */
const POSTABLE_SCAN_COUNT = 200;

@Injectable()
export class PlanFeedService {
  constructor(
    private readonly planFeedRepositoryService: PlanFeedRepositoryService,
    private readonly planFeedVoteRepositoryService: PlanFeedVoteRepositoryService,
    private readonly planScheduleRepositoryService: PlanScheduleRepositoryService,
    private readonly planUserRepositoryService: PlanUserRepositoryService,
  ) {}

  async getPlanFeedList(
    viewerPlanUserId: string,
    query: GetPlanFeedListRequest,
  ): Promise<[GetPlanFeedResponse[], number]> {
    const [entities, total] =
      await this.planFeedRepositoryService.findAndCountPublished({
        categoryName: query.category,
        region: query.region,
        minAmount: query.minAmount,
        maxAmount: query.maxAmount,
        sort: query.sort ?? PlanFeedSort.RECENT,
        page: query.page ?? 1,
        count: query.count ?? 20,
      });

    const myVotes = await this.planFeedVoteRepositoryService.findMyVotes(
      viewerPlanUserId,
      entities.map((entity) => entity.id),
    );

    return [
      entities.map((entity) =>
        GetPlanFeedResponse.from(entity, viewerPlanUserId, myVotes),
      ),
      total,
    ];
  }

  async getMyPlanFeedList(
    planUserId: string,
    page: number,
    count: number,
  ): Promise<[GetPlanFeedResponse[], number]> {
    const [entities, total] =
      await this.planFeedRepositoryService.findAndCountByPlanUserId(
        planUserId,
        page,
        count,
      );

    const myVotes = await this.planFeedVoteRepositoryService.findMyVotes(
      planUserId,
      entities.map((entity) => entity.id),
    );

    return [
      entities.map((entity) =>
        GetPlanFeedResponse.from(entity, planUserId, myVotes),
      ),
      total,
    ];
  }

  /**
   * 후기를 올린다.
   *
   * 일정에서 옮겨 담는 게 기본이고, 그때 값은 **일정에서 읽어 복사**한다.
   * 클라이언트가 보낸 금액을 그대로 믿으면 아무 값이나 시세로 올릴 수 있다.
   */
  async postPlanFeed(
    planUserId: string,
    body: PostPlanFeedRequest,
  ): Promise<GetPlanFeedResponse> {
    const source = body.scheduleId
      ? await this.readSourceSchedule(planUserId, body.scheduleId)
      : {
          categoryName: body.categoryName?.trim(),
          title: body.title?.trim(),
          amount: body.amount ?? null,
          location: body.location ?? null,
          sourceScheduleId: null,
        };
    const { amount, location, sourceScheduleId } = source;
    const { categoryName, title } = source;

    if (!categoryName || !title) {
      throw new ServiceError(
        'categoryName and title are required',
        ServiceErrorCode.BAD_REQUEST,
      );
    }

    const planUser = await this.planUserRepositoryService.getById(planUserId);

    const entity = await this.planFeedRepositoryService.save(
      plainToInstance(PlanFeedPostEntity, {
        planUserId,
        sourceScheduleId,
        categoryName,
        title,
        amount,
        isAmountPublic: body.isAmountPublic ?? true,
        // 자르는 일은 여기서 한다. 프론트에 맡기면 앱마다 다르게 자르고,
        // 한 곳만 빠뜨려도 전체 주소가 그대로 올라간다.
        region: toRegion(location),
        rating: body.rating,
        body: body.body?.trim() || null,
        authorDDay: daysUntilWedding(planUser?.weddingDate),
        authorRole: body.authorRole ?? PlanFeedAuthorRole.UNKNOWN,
        helpfulCount: 0,
        notHelpfulCount: 0,
        status: PlanFeedPostStatus.PUBLISHED,
      }),
    );

    return GetPlanFeedResponse.from(entity, planUserId, new Map());
  }

  async deletePlanFeed(planUserId: string, id: number): Promise<void> {
    const post = await this.planFeedRepositoryService.findById(id);

    if (!post) {
      throw new ServiceError(
        `Feed post not found id: ${id}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    if (post.planUserId !== planUserId) {
      throw new ServiceError(
        `Not your post id: ${id}`,
        ServiceErrorCode.FORBIDDEN,
      );
    }

    post.status = PlanFeedPostStatus.DELETE;
    await this.planFeedRepositoryService.save(post);
  }

  /**
   * 평가. 같은 값을 다시 보내면 취소다 (토글).
   *
   * 마음을 바꾸면 행을 하나 더 만들지 않고 값을 뒤집는다 — 그래야 한 사람이
   * 한 표라는 규칙이 유지된다. 개수는 세지 않고 비정규화 컬럼을 옮긴다.
   * 같은 트랜잭션이라 표와 개수가 어긋나지 않는다.
   */
  @Transactional()
  async votePlanFeed(
    planUserId: string,
    id: number,
    value: PlanFeedVoteValue,
  ): Promise<PlanFeedVoteResponse> {
    const post = await this.requirePublishedPost(id);
    const existing = await this.planFeedVoteRepositoryService.findOne(
      id,
      planUserId,
    );

    // 같은 값 다시 → 취소
    if (existing?.value === value) {
      return this.cancelPlanFeedVote(planUserId, id);
    }

    let helpfulDelta = 0;
    let notHelpfulDelta = 0;
    if (existing) {
      // 마음을 바꾼 경우: 이전 표를 빼고 새 표를 더한다
      if (existing.value === PlanFeedVoteValue.HELPFUL) helpfulDelta -= 1;
      else notHelpfulDelta -= 1;
      existing.value = value;
      await this.planFeedVoteRepositoryService.save(existing);
    } else {
      await this.planFeedVoteRepositoryService.save(
        plainToInstance(PlanFeedVoteEntity, { postId: id, planUserId, value }),
      );
    }
    if (value === PlanFeedVoteValue.HELPFUL) helpfulDelta += 1;
    else notHelpfulDelta += 1;

    await this.planFeedRepositoryService.increaseCounts(
      id,
      helpfulDelta,
      notHelpfulDelta,
    );

    return {
      myVote: value,
      helpfulCount: Math.max(0, post.helpfulCount + helpfulDelta),
    };
  }

  /** 평가 취소. 없으면 지금 상태를 그대로 돌려준다 */
  @Transactional()
  async cancelPlanFeedVote(
    planUserId: string,
    id: number,
  ): Promise<PlanFeedVoteResponse> {
    const post = await this.requirePublishedPost(id);
    const existing = await this.planFeedVoteRepositoryService.findOne(
      id,
      planUserId,
    );
    if (!existing) {
      return { myVote: null, helpfulCount: post.helpfulCount };
    }

    await this.planFeedVoteRepositoryService.remove(id, planUserId);
    const isHelpful = existing.value === PlanFeedVoteValue.HELPFUL;
    await this.planFeedRepositoryService.increaseCounts(
      id,
      isHelpful ? -1 : 0,
      isHelpful ? 0 : -1,
    );

    return {
      myVote: null,
      // 음수로 내려가지 않게 바닥을 잡는다
      helpfulCount: Math.max(0, post.helpfulCount - (isHelpful ? 1 : 0)),
    };
  }

  /** 피드 사이드의 "내 후기" 패널 */
  async getMyStatus(planUserId: string): Promise<GetPlanFeedMyStatusResponse> {
    const [posts, postCount] =
      await this.planFeedRepositoryService.findAndCountByPlanUserId(
        planUserId,
        1,
        POSTABLE_SCAN_COUNT,
      );

    const receivedHelpfulCount =
      await this.planFeedVoteRepositoryService.countHelpfulForPostIds(
        posts.map((post) => post.id),
      );

    const postable = await this.getPostableSchedules(planUserId);

    return {
      postCount,
      receivedHelpfulCount,
      postableScheduleCount: postable.length,
    };
  }

  /**
   * 완료했는데 아직 후기로 안 올린 일정.
   *
   * 피드의 생사는 콘텐츠 공급에 달려 있고, 사람들은 "무엇을 올릴 수 있는지"
   * 를 모르면 안 올린다. 빈 화면에 "첫 후기를 써 보세요" 대신 이 목록을 준다.
   */
  async getPostableSchedules(
    planUserId: string,
  ): Promise<GetPostableScheduleResponse[]> {
    const [schedules] = await this.planScheduleRepositoryService.getList(
      1,
      POSTABLE_SCAN_COUNT,
      planUserId,
      undefined,
      PlanScheduleStatus.COMPLETED,
      undefined,
      PlanScheduleSortColumn.START_DATE,
      DatabaseSort.DESC,
    );

    const postedIds =
      await this.planFeedRepositoryService.findPostedScheduleIds(
        planUserId,
        schedules.map((schedule) => schedule.id),
      );
    const posted = new Set(postedIds);

    return schedules
      .filter((schedule) => !posted.has(schedule.id))
      .map((schedule) => ({
        scheduleId: schedule.id,
        categoryName: schedule.categoryName,
        title: schedule.title,
        amount: schedule.amount ?? null,
        location: schedule.location ?? null,
        startDate: schedule.startDate ?? null,
      }));
  }

  /**
   * 일정에서 값을 읽어 온다.
   *
   * **클라이언트가 보낸 금액을 그대로 믿지 않는다.** 그러면 아무 숫자나
   * 시세로 올릴 수 있어서 피드의 유일한 값어치가 무너진다.
   */
  private async readSourceSchedule(
    planUserId: string,
    scheduleId: number,
  ): Promise<{
    categoryName: string;
    title: string;
    amount: number | null;
    location: string | null;
    sourceScheduleId: number;
  }> {
    const schedule =
      await this.planScheduleRepositoryService.findById(scheduleId);

    if (!schedule || schedule.planUserId !== planUserId) {
      throw new ServiceError(
        `Plan schedule not found scheduleId: ${scheduleId}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    // 완료한 일정만 후기가 된다. 예정 금액은 아직 "쓴 돈" 이 아니다.
    if (schedule.status !== PlanScheduleStatus.COMPLETED) {
      throw new ServiceError(
        `Only completed schedules can be posted scheduleId: ${scheduleId}`,
        ServiceErrorCode.BAD_REQUEST,
      );
    }

    const already = await this.planFeedRepositoryService.findBySourceScheduleId(
      planUserId,
      scheduleId,
    );
    if (already) {
      throw new ServiceError(
        `Already posted scheduleId: ${scheduleId}`,
        ServiceErrorCode.BAD_REQUEST,
      );
    }

    return {
      categoryName: schedule.categoryName,
      title: schedule.title,
      amount: schedule.amount ?? null,
      location: schedule.location ?? null,
      sourceScheduleId: schedule.id,
    };
  }

  private async requirePublishedPost(id: number): Promise<PlanFeedPostEntity> {
    const post = await this.planFeedRepositoryService.findById(id);

    if (!post || post.status !== PlanFeedPostStatus.PUBLISHED) {
      throw new ServiceError(
        `Feed post not found id: ${id}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return post;
  }
}

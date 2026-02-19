import { PlanUserEntity } from '@app/repository/entity/plan-user.entity';
import { PlanScheduleRepositoryService } from '@app/repository/service/plan-schedule.repository.service';
import { PlanUserRoomMemberRepositoryService } from '@app/repository/service/plan-user--room-member.repository.service';
import { PlanUserRoomRepositoryService } from '@app/repository/service/plan-user-room.repository.service';
import { PlanUserRepositoryService } from '@app/repository/service/plan-user.repository.service';
import { Injectable } from '@nestjs/common';

import {
  GetPlanUserAmountCategory,
  GetPlanUserAmountResponse,
  GetPlanUserRoomMemberResponse,
  PatchPlanUserRequest,
  PatchPlanUserResponse,
} from './plan-user.dto';
import { GetPlanUserTotalAmountResponse } from '../schedule/plan-schedule.dto';

@Injectable()
export class PlanUserService {
  constructor(
    private readonly planUserRepositoryService: PlanUserRepositoryService,
    private readonly planScheduleRepositoryService: PlanScheduleRepositoryService,
    private readonly planUserRoomRepositoryService: PlanUserRoomRepositoryService,
    private readonly planUserRoomMemberRepositoryService: PlanUserRoomMemberRepositoryService,
  ) {}

  async patchPlanUser(
    id: string,
    patchPlanUserRequest: PatchPlanUserRequest,
  ): Promise<PatchPlanUserResponse> {
    const planUser = await this.planUserRepositoryService.getById(id);

    planUser.weddingDate = new Date(patchPlanUserRequest.weddingDate);
    planUser.budget = patchPlanUserRequest.budget;
    planUser.name = patchPlanUserRequest.name;

    await this.planUserRepositoryService.update(planUser);

    return PatchPlanUserResponse.from(planUser);
  }

  async getPlanUserTotalAmount(
    id: string,
    budget: number,
  ): Promise<GetPlanUserTotalAmountResponse> {
    const planUserRoomEntity =
      await this.planUserRoomRepositoryService.findByOwnerId(id);

    const planAmount = await this.planScheduleRepositoryService.getPlanAmount(
      id,
      planUserRoomEntity?.id,
    );

    return GetPlanUserTotalAmountResponse.from(
      budget,
      planAmount,
      budget - planAmount,
    );
  }

  async getPlanUserAmount(
    userEntity: PlanUserEntity,
  ): Promise<GetPlanUserAmountResponse> {
    const planUserRoomEntity =
      await this.planUserRoomRepositoryService.findByOwnerId(userEntity.id);

    const plannedUseAmount =
      await this.planScheduleRepositoryService.getPlannedUseAmount(
        userEntity.id,
        planUserRoomEntity?.id,
      );
    const usedAmount = await this.planScheduleRepositoryService.getUsedAmount(
      userEntity.id,
      planUserRoomEntity?.id,
    );

    return GetPlanUserAmountResponse.from(
      userEntity.budget,
      plannedUseAmount,
      usedAmount,
    );
  }

  async getPlanUserCategoryChartList(
    id: string,
    categoryName: string,
  ): Promise<GetPlanUserAmountCategory[]> {
    const categoryChartList =
      await this.planScheduleRepositoryService.getCategoryChartList(
        id,
        undefined,
        categoryName,
      );

    return categoryChartList.map((v) =>
      GetPlanUserAmountCategory.from(
        v.categoryName,
        v.totalAmount,
        v.usedAmount,
      ),
    );
  }

  async getPlanUserRoomMemberListByUserId(
    userId: string,
  ): Promise<GetPlanUserRoomMemberResponse[]> {
    const planUserRoom =
      await this.planUserRoomRepositoryService.findByOwnerId(userId);

    if (!planUserRoom) {
      return [];
    }

    const planUserRoomMemberList =
      await this.planUserRoomMemberRepositoryService.getByRoomId(
        planUserRoom.id,
      );

    return planUserRoomMemberList.map((v) =>
      GetPlanUserRoomMemberResponse.from(v.planUser),
    );
  }

  async postHasSeenMainGuide(id: string): Promise<void> {
    const planUser = await this.planUserRepositoryService.getById(id);
    planUser.hasSeenMainGuideDate = new Date();
    await this.planUserRepositoryService.update(planUser);
  }

  async postHasSeenBudgetGuide(id: string): Promise<void> {
    const planUser = await this.planUserRepositoryService.getById(id);
    planUser.hasSeenBudgetGuideDate = new Date();
    await this.planUserRepositoryService.update(planUser);
  }
}

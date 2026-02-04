import { PlanScheduleRepositoryService } from '@app/repository/service/plan-schedule.repository.service';
import { PlanUserRepositoryService } from '@app/repository/service/plan-user.repository.service';
import { Injectable } from '@nestjs/common';

import {
  GetPlanUserAmountCategory,
  GetPlanUserAmountResponse,
  PatchPlanUserRequest,
  PatchPlanUserResponse,
} from './plan-user.dto';

@Injectable()
export class PlanUserService {
  constructor(
    private readonly planUserRepositoryService: PlanUserRepositoryService,
    private readonly planScheduleRepositoryService: PlanScheduleRepositoryService,
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

  async getPlanUserTotalAmount(id: string): Promise<number> {
    const totalAmount =
      await this.planScheduleRepositoryService.getTotalAmount(id);

    return totalAmount;
  }

  async getPlanUserAmount(id: string): Promise<GetPlanUserAmountResponse> {
    const user = await this.planUserRepositoryService.getById(id);
    const plannedUseAmount =
      await this.planScheduleRepositoryService.getPlannedUseAmount(id);
    const usedAmount =
      await this.planScheduleRepositoryService.getUsedAmount(id);

    return GetPlanUserAmountResponse.from(
      user.budget,
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
}

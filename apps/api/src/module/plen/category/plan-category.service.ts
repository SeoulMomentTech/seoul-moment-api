import { PlanCategoryRepositoryService } from '@app/repository/service/plan-category.repository.service';
import { PlanUserRoomRepositoryService } from '@app/repository/service/plan-user-room.repository.service';
import { Injectable } from '@nestjs/common';

import { GetPlanCategoryResponse } from './plan-category.dto';

@Injectable()
export class PlanCategoryService {
  constructor(
    private readonly planCategoryRepositoryService: PlanCategoryRepositoryService,
    private readonly planUserRoomRepositoryService: PlanUserRoomRepositoryService,
  ) {}

  async getPlanCategoryList(): Promise<GetPlanCategoryResponse[]> {
    const planCategoryEntityList =
      await this.planCategoryRepositoryService.findAll();

    return planCategoryEntityList.map((v) => GetPlanCategoryResponse.from(v));
  }

  async getPlanUserCategoryList(
    userId: string,
  ): Promise<GetPlanCategoryResponse[]> {
    const planUserCategoryEntityList =
      await this.planCategoryRepositoryService.findAll(userId);

    return planUserCategoryEntityList.map((v) =>
      GetPlanCategoryResponse.from(v),
    );
  }

  async getPlanRoomCategoryList(
    roomId: number,
  ): Promise<GetPlanCategoryResponse[]> {
    const planUserCategoryEntityList =
      await this.planCategoryRepositoryService.findAll(undefined, roomId);

    return planUserCategoryEntityList.map((v) =>
      GetPlanCategoryResponse.from(v),
    );
  }
}

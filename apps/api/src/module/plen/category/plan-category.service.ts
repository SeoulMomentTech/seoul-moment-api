import { PlanCategoryRepositoryService } from '@app/repository/service/plan-category.repository.service';
import { Injectable } from '@nestjs/common';

import { GetPlanCategoryResponse } from './plan-category.dto';

@Injectable()
export class PlanCategoryService {
  constructor(
    private readonly planCategoryRepositoryService: PlanCategoryRepositoryService,
  ) {}

  async getPlanCategoryList(): Promise<GetPlanCategoryResponse[]> {
    const planCategoryEntityList =
      await this.planCategoryRepositoryService.findAll();
    return planCategoryEntityList.map((v) => GetPlanCategoryResponse.from(v));
  }
}

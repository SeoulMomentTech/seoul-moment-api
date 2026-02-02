import { PlanUserRepositoryService } from '@app/repository/service/plan-user.repository.service';
import { Injectable } from '@nestjs/common';

import { PatchPlanUserRequest, PatchPlanUserResponse } from './plan-user.dto';

@Injectable()
export class PlanUserService {
  constructor(
    private readonly planUserRepositoryService: PlanUserRepositoryService,
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
}

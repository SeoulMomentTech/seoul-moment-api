import { PlanUserRepositoryService } from '@app/repository/service/plan-user.repository.service';
import { Injectable } from '@nestjs/common';

import {
  PatchPlanSettingRequest,
  PatchPlanSettingResponse,
} from './plan-setting.dto';

@Injectable()
export class PlanSettingService {
  constructor(
    private readonly planUserRepositoryService: PlanUserRepositoryService,
  ) {}

  async patchPlanSetting(
    id: string,
    patchPlanSettingRequest: PatchPlanSettingRequest,
  ): Promise<PatchPlanSettingResponse> {
    const planUser = await this.planUserRepositoryService.getById(id);

    planUser.weddingDate = new Date(patchPlanSettingRequest.weddingDate);
    planUser.budget = patchPlanSettingRequest.budget;
    planUser.name = patchPlanSettingRequest.name;

    await this.planUserRepositoryService.update(planUser);

    return PatchPlanSettingResponse.from(planUser);
  }
}

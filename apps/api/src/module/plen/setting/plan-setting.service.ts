import { PlanUserRepositoryService } from '@app/repository/service/plan-user.repository.service';
import { Injectable } from '@nestjs/common';

import {
  PostPlanSettingRequest,
  PostPlanSettingResponse,
} from './plan-setting.dto';

@Injectable()
export class PlanSettingService {
  constructor(
    private readonly planUserRepositoryService: PlanUserRepositoryService,
  ) {}

  async postPlanSetting(
    id: string,
    postPlanSettingRequest: PostPlanSettingRequest,
  ): Promise<PostPlanSettingResponse> {
    const planUser = await this.planUserRepositoryService.getById(id);

    planUser.weddingDate = postPlanSettingRequest.weddingDate
      ? new Date(postPlanSettingRequest.weddingDate)
      : null;
    planUser.budget = postPlanSettingRequest.budget;
    planUser.name = postPlanSettingRequest.name;

    await this.planUserRepositoryService.update(planUser);

    return PostPlanSettingResponse.from(planUser);
  }
}

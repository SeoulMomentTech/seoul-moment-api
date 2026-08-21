import {
  PlanActivityTargetType,
  PlanActivityType,
} from '@app/repository/enum/plan-activity.enum';
import { PlanUserRoomRepositoryService } from '@app/repository/service/plan-user-room.repository.service';
import { PlanUserRepositoryService } from '@app/repository/service/plan-user.repository.service';
import { Injectable } from '@nestjs/common';

import {
  PostPlanSettingRequest,
  PostPlanSettingResponse,
} from './plan-setting.dto';
import { PlanActivityService } from '../activity/plan-activity.service';

@Injectable()
export class PlanSettingService {
  constructor(
    private readonly planUserRepositoryService: PlanUserRepositoryService,
    private readonly planUserRoomRepositoryService: PlanUserRoomRepositoryService,
    private readonly planActivityService: PlanActivityService,
  ) {}

  async postPlanSetting(
    id: string,
    postPlanSettingRequest: PostPlanSettingRequest,
  ): Promise<PostPlanSettingResponse> {
    const planUser = await this.planUserRepositoryService.getById(id);
    const previousBudget = planUser.budget;

    planUser.weddingDate = postPlanSettingRequest.weddingDate
      ? new Date(postPlanSettingRequest.weddingDate)
      : null;
    planUser.budget = postPlanSettingRequest.budget;
    planUser.name = postPlanSettingRequest.name;
    // 온보딩은 예식장 이름을 묻지 않는다. 무조건 대입하면 프로필에서 넣어 둔
    // 값이 온보딩을 다시 저장할 때마다 지워지므로, 보낸 경우에만 반영한다.
    if (postPlanSettingRequest.weddingVenue !== undefined) {
      planUser.weddingVenue = postPlanSettingRequest.weddingVenue || null;
    }
    planUser.requiredAgreementDate =
      postPlanSettingRequest.requiredAgreementDate
        ? new Date(postPlanSettingRequest.requiredAgreementDate)
        : null;
    planUser.adAgreementDate = postPlanSettingRequest.adAgreementDate
      ? new Date(postPlanSettingRequest.adAgreementDate)
      : null;

    await this.planUserRepositoryService.update(planUser);

    // 온보딩·프로필 저장은 예산이 그대로여도 호출된다. 값이 실제로 바뀐
    // 경우만 남기지 않으면 "예산을 수정했어요"가 저장할 때마다 쌓인다.
    if (previousBudget !== planUser.budget) {
      // 방을 만든 사람이면 방 기록으로, 아니면 개인 기록으로 남긴다.
      const room = await this.planUserRoomRepositoryService.findByOwnerId(id);

      await this.planActivityService.record({
        type: PlanActivityType.BUDGET_UPDATED,
        planUserId: id,
        planUserRoomId: room?.id ?? null,
        targetType: PlanActivityTargetType.USER,
        amount: planUser.budget,
      });
    }

    return PostPlanSettingResponse.from(planUser);
  }
}

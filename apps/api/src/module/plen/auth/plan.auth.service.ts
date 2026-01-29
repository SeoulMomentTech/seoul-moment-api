import { PlanUserEntity } from '@app/repository/entity/plan-user.entity';
import { PlatformType } from '@app/repository/enum/plan-user.enum';
import { PlanUserRepositoryService } from '@app/repository/service/plan-user.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { PostPlanLoginRequest, PostPlanLoginResponse } from './plan.auth.dto';

@Injectable()
export class PlanAuthService {
  constructor(
    private readonly planUserRepositoryService: PlanUserRepositoryService,
  ) {}

  async login(
    signUpRequest: PostPlanLoginRequest,
    platformType: PlatformType,
  ): Promise<PostPlanLoginResponse> {
    let planUser = await this.planUserRepositoryService.findByPlatfomeType(
      platformType,
      signUpRequest.id,
    );

    if (!planUser) {
      planUser = await this.planUserRepositoryService.create(
        plainToInstance(PlanUserEntity, {
          [platformType + 'Id']: signUpRequest.id,
          [platformType + 'Email']: signUpRequest.email,
        }),
      );
    }

    return PostPlanLoginResponse.from(planUser);
  }
}

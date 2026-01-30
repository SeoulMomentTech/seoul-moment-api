import { JwtType } from '@app/auth/auth.dto';
import { CommonAuthService } from '@app/auth/auth.service';
import { KakaoService } from '@app/external/kakao/kakao.service';
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
    private readonly commonAuthService: CommonAuthService,
    private readonly kakaoService: KakaoService,
  ) {}

  async login(
    signUpRequest: PostPlanLoginRequest,
    platformType: PlatformType,
  ): Promise<PostPlanLoginResponse> {
    const kakaoValidateTokenResponse = await this.kakaoService.validateToken(
      signUpRequest.kakaoToken,
    );

    let planUser = await this.planUserRepositoryService.findByPlatfomeType(
      platformType,
      kakaoValidateTokenResponse.id,
    );

    if (!planUser) {
      planUser = await this.planUserRepositoryService.create(
        plainToInstance(PlanUserEntity, {
          [platformType + 'Id']: kakaoValidateTokenResponse.id,
          [platformType + 'Email']: signUpRequest.email,
        }),
      );
    }

    const jwtToken = await this.commonAuthService.generateJwt(
      {
        planUserId: planUser.id,
        kakaoId: kakaoValidateTokenResponse.id,
        kakaoToken: signUpRequest.kakaoToken,
      },
      JwtType.ONE_TIME_TOKEN,
      '36500d', // 무제한(약 100년)
    );

    return PostPlanLoginResponse.from(jwtToken);
  }
}

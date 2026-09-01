import { JwtType } from '@app/auth/auth.dto';
import { CommonAuthService } from '@app/auth/auth.service';
import { KakaoService } from '@app/external/kakao/kakao.service';
import { PlanUserEntity } from '@app/repository/entity/plan-user.entity';
import { PlatformType } from '@app/repository/enum/plan-user.enum';
import { PlanUserRepositoryService } from '@app/repository/service/plan-user.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { v4 as uuidV4 } from 'uuid';

import { PostPlanLoginRequest, PostPlanLoginResponse } from './plan.auth.dto';
import {
  buildPlanTokenPayload,
  PLAN_SESSION_EXPIRE_TIME,
} from '../plan.session';

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

    const kakaoUserInfo = await this.kakaoService.getUserInfo(
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
          [platformType + 'Email']: kakaoUserInfo.kakao_account.email,
          roomShareCode: uuidV4(),
        }),
      );
    }

    const jwtToken = await this.commonAuthService.generateJwt(
      buildPlanTokenPayload(planUser, platformType),
      JwtType.ONE_TIME_TOKEN,
      PLAN_SESSION_EXPIRE_TIME,
    );

    return PostPlanLoginResponse.from(jwtToken);
  }

  /**
   * 모든 기기에서 로그아웃. 이 사용자에게 나간 토큰이 전부 즉시 무효가 된다.
   *
   * 기기를 하나만 끊을 수는 없다 — 세대 값 하나로 회수하는 방식이라
   * 기기별로 나누려면 세션 테이블이 따로 있어야 한다. 그래서 평소 로그아웃
   * (그 기기의 저장된 토큰을 지우는 것)과는 다른 자리에 둔다.
   */
  async logoutAll(planUserId: string): Promise<void> {
    await this.planUserRepositoryService.incrementTokenVersion(planUserId);
  }
}

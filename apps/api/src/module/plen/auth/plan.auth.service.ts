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

/**
 * 로그인 세션 수명.
 *
 * 예전에는 `36500d`(약 100년)였다. 회수할 방법이 없는 토큰에 붙일 수명이
 * 아니고, 어차피 가드가 카카오 토큰을 매번 확인해서 실제로는 6시간이면
 * 끊겼다. 지금은 이 값이 그대로 세션 수명이다 — 탭을 닫든 기기를 재부팅하든
 * 반년 안에 다시 들어오면 로그인 상태가 유지된다.
 *
 * 갱신(슬라이딩)은 아직 없다. 넣으려면 응답으로 새 토큰을 돌려주고 프론트가
 * 그걸 받아 저장해야 한다.
 */
const PLAN_SESSION_EXPIRE_TIME = '180d';

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
      {
        platformType,
        planUserId: planUser.id,
        kakaoId: kakaoValidateTokenResponse.id,
        tokenVersion: planUser.tokenVersion ?? 0,
      },
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

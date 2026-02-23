import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { KakaoService } from '@app/external/kakao/kakao.service';
import { PlanUserEntity } from '@app/repository/entity/plan-user.entity';
import { PlatformType } from '@app/repository/enum/plan-user.enum';
import { PlanUserRepositoryService } from '@app/repository/service/plan-user.repository.service';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class PlanApiGuard implements CanActivate {
  constructor(
    @Inject()
    private readonly kakaoService: KakaoService,
    @Inject()
    private readonly planUserRepositoryService: PlanUserRepositoryService,
    @Inject()
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    let token = request.headers.authorization;

    if (!token) {
      throw new ServiceError('Token not found', ServiceErrorCode.UNAUTHORIZED);
    }

    token = token.split(' ')[1];

    let payload: Record<string, any> = {};
    try {
      payload = this.jwtService.verify(token);
    } catch (error) {
      throw new ServiceError(
        `Invalid token: ${error.message}`,
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    let planUser = null;
    if (payload.platformType === PlatformType.KAKAO) {
      planUser = await this.validateKakaoToken(payload);
    }

    request.user = planUser;

    return true;
  }

  private async validateKakaoToken(
    payload: Record<string, any>,
  ): Promise<PlanUserEntity> {
    if (!payload) {
      throw new ServiceError('Invalid token', ServiceErrorCode.UNAUTHORIZED);
    }

    await this.kakaoService.validateToken(payload.kakaoToken);

    const planUser = await this.planUserRepositoryService.findByKakaoInfo(
      payload.kakaoId,
      payload.planUserId,
    );

    if (!planUser) {
      throw new ServiceError(
        `Plan user not found kakaoId: ${payload.kakaoId}, planUserId: ${payload.planUserId}`,
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    planUser.lastLoginDate = new Date();
    await this.planUserRepositoryService.update(planUser);

    return planUser;
  }
}

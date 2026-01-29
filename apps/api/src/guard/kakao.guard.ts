import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { KakaoService } from '@app/external/kakao/kakao.service';
import { PlanUserRepositoryService } from '@app/repository/service/plan-user.repository.service';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class KakaoGuard implements CanActivate {
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
    const token = request.headers.authorization.split(' ')[1];

    if (!token) {
      throw new ServiceError('Token not found', ServiceErrorCode.UNAUTHORIZED);
    }

    const payload = this.jwtService.verify(token);

    if (!payload) {
      throw new ServiceError('Invalid token', ServiceErrorCode.UNAUTHORIZED);
    }

    const kakaoValidateTokenResponse =
      await this.kakaoService.validateToken(token);

    const planUser = await this.planUserRepositoryService.getByKakaoInfo(
      kakaoValidateTokenResponse.app_id,
      payload.planUserId,
    );

    request.user = planUser;

    return true;
  }
}

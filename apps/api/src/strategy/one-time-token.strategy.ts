import { JwtType } from '@app/auth/auth.dto';
import { getTokenSubjectId, isAdminToken } from '@app/auth/auth.token';
import { Configuration } from '@app/config/configuration';
import { AdminRepositoryService } from '@app/repository/service/admin.repository.service';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class OneTimeTokenStrategy extends PassportStrategy(
  Strategy,
  'one_time_token',
) {
  constructor(
    @Inject() private readonly adminRepositoryService: AdminRepositoryService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // 만료된 토큰 거부
      secretOrKey: Configuration.getConfig().JWT_SECRET, // 환경 변수로 대체 권장
      passReqToCallback: true, // request data
    });
  }

  async validate(request: any, payload: Record<string, any>) {
    if (payload.jwtType !== JwtType.ONE_TIME_TOKEN)
      throw new HttpException('Invalid token type', HttpStatus.UNAUTHORIZED);

    // 회원 토큰도 같은 시크릿·jwtType 이라 aud 로 관리자 토큰만 가려낸다
    const adminId = getTokenSubjectId(payload);

    if (!isAdminToken(payload) || adminId === null)
      throw new HttpException('Not an admin token', HttpStatus.UNAUTHORIZED);

    const adminEntity = await this.adminRepositoryService.getAdminById(adminId);

    return adminEntity;
  }
}

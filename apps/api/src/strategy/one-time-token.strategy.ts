import { JwtType } from '@app/auth/auth.dto';
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

    const adminEntity = await this.adminRepositoryService.getAdminById(
      payload.id,
    );

    return adminEntity;
  }
}

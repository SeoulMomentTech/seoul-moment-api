import { JwtType } from '@app/auth/auth.dto';
import { Configuration } from '@app/config/configuration';
import { UserRepositoryService } from '@app/repository/service/user.repository.service';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class UserRefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'user_refresh_token',
) {
  constructor(
    @Inject() private readonly userRepositoryService: UserRepositoryService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: true,
      secretOrKey: Configuration.getConfig().JWT_SECRET, // 환경 변수로 대체 권장
      passReqToCallback: true,
    });
  }

  async validate(request: any, payload: Record<string, any>) {
    if (payload.jwtType !== JwtType.REFRESH_TOKEN)
      throw new HttpException('Invalid token type', HttpStatus.FORBIDDEN);

    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(request);

    // 탈퇴한 회원은 소프트 삭제되어 조회되지 않으므로 리프레시도 막힌다.
    const userEntity =
      await this.userRepositoryService.findUserByIdWithRefreshToken(payload.id);

    if (!userEntity)
      throw new HttpException(
        'Withdrawn or unknown user',
        HttpStatus.UNAUTHORIZED,
      );

    if (!userEntity.refreshToken || token !== userEntity.refreshToken)
      throw new HttpException('Invalid refresh token', HttpStatus.FORBIDDEN);

    return userEntity;
  }
}

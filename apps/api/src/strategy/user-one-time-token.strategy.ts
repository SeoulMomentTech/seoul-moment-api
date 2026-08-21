import { JwtType } from '@app/auth/auth.dto';
import { Configuration } from '@app/config/configuration';
import { UserRepositoryService } from '@app/repository/service/user.repository.service';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class UserOneTimeTokenStrategy extends PassportStrategy(
  Strategy,
  'user_one_time_token',
) {
  constructor(
    @Inject() private readonly userRepositoryService: UserRepositoryService,
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

    // 탈퇴한 회원은 소프트 삭제되어 조회되지 않는다. 남아 있던 액세스
    // 토큰도 이 시점에 무효가 된다.
    const userEntity = await this.userRepositoryService.findUserById(
      payload.id,
    );

    if (!userEntity)
      throw new HttpException(
        'Withdrawn or unknown user',
        HttpStatus.UNAUTHORIZED,
      );

    return userEntity;
  }
}

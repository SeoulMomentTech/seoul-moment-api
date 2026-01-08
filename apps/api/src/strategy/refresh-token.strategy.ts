import { JwtType } from '@app/auth/auth.dto';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Configuration } from '@app/config/configuration';
import { AdminRepositoryService } from '@app/repository/service/admin.repository.service';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'refresh_token',
) {
  constructor(
    @Inject() private readonly adminRepositoryService: AdminRepositoryService,
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

    if (Date.now() > payload.exp * 1000) {
      // ServiceError를 던져서 만료된 토큰을 처리
      throw new ServiceError('please login', ServiceErrorCode.FORBIDDEN); // 만료된 토큰을 401로 처리
    }

    const adminEntity = await this.adminRepositoryService.getAdminById(
      payload.id,
    );

    if (!adminEntity.refreshToken || token !== adminEntity.refreshToken)
      throw new HttpException(
        '!adminEntity.refreshToken || token !== adminEntity.refreshToken',
        HttpStatus.FORBIDDEN,
      );

    return adminEntity;
  }
}

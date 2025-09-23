/* eslint-disable max-lines-per-function */
import { CacheService } from '@app/cache/cache.service';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { HtmlTemplate } from '@app/common/templates/templates.enum';
import { Configuration } from '@app/config/configuration';
import { ExternalGoogleMailService } from '@app/external/google/google-mail.service';
import { HttpRequestService } from '@app/http/http.service';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { JwtType } from './auth.dto';

@Injectable()
export class CommonAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly externalGoogleMailService: ExternalGoogleMailService,
    private readonly cacheService: CacheService,
    private readonly httpService: HttpRequestService,
  ) {}

  async generateJwt(
    payload: Record<string, any>,
    jwtType: JwtType,
    expireTime: string, // 예: '60s', '1h' 등
  ): Promise<string> {
    return this.jwtService.signAsync(
      {
        ...payload,
        jwtType,
      },
      { expiresIn: expireTime }, // ★ 이 옵션이 exp 클레임을 만들어 줍니다.
    );
  }

  async authEmail(email: string) {
    const code = Math.floor(100000 + Math.random() * 900000);

    this.externalGoogleMailService.sendMailByTemplate(
      email,
      'Email Verification Code',
      HtmlTemplate.AUTH_CODE,
      { code },
    );

    await this.cacheService.set(email, code, 60 * 5);
  }

  async verifyEmail(email: string, code: number) {
    const cachedCode = await this.cacheService.get(email);

    if (!cachedCode) {
      throw new ServiceError(
        '인증 코드가 만료되었습니다.',
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    if (parseInt(cachedCode, 10) !== code) {
      throw new ServiceError(
        '인증 코드가 일치하지 않습니다.',
        ServiceErrorCode.UNAUTHORIZED,
      );
    }
  }

  async verifyRecaptcha(token: string) {
    const { result, data } = await this.httpService.sendPostRequest(
      'https://www.google.com/recaptcha/api/siteverify',
      {
        secret: Configuration.getConfig().RECAPTCHA_SECRET_KEY,
        response: token,
      },
    );

    if (!result) {
      throw new ServiceError(
        'Recaptcha 인증에 실패했습니다.',
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    return data;
  }
}

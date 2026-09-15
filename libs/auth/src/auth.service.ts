/* eslint-disable max-lines-per-function */
import { RedisKey } from '@app/cache/cache.dto';
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

  async verifyJwt(token: string): Promise<Record<string, any>> {
    try {
      return await this.jwtService.verifyAsync(token);
    } catch (error) {
      throw new ServiceError(
        `유효하지 않은 토큰입니다: ${error.message}`,
        ServiceErrorCode.UNAUTHORIZED,
      );
    }
  }

  async authEmail(email: string) {
    return this.authEmailWithKey(email, email);
  }

  async verifyEmail(email: string, code: number) {
    return this.verifyEmailWithKey(email, code);
  }

  /**
   * 인증 코드를 메일로 보내고 cacheKey 에 저장한다.
   * 수신자와 캐시 키를 분리해 두는 이유는, 검증 시점에 이메일을 다시 받지 않는
   * 흐름(LINE Bot 처럼 식별자만 들고 오는 경우) 때문이다. 키를 이메일로 두면
   * 회원가입·비밀번호 찾기 코드와 같은 자리를 써서 서로 덮어쓴다.
   */
  async authEmailWithKey(cacheKey: string, email: string) {
    const code = Math.floor(100000 + Math.random() * 900000);

    // 발송 성공을 확인한 뒤에 코드를 저장한다. 발송을 기다리지 않으면
    // 메일이 실패해도 API가 200을 돌려주고 코드만 캐시에 남아,
    // 사용자는 오지 않는 메일을 기다리고 장애도 드러나지 않는다.
    try {
      await this.externalGoogleMailService.sendMailByTemplate(
        email,
        'Email Verification Code',
        HtmlTemplate.AUTH_CODE,
        { code },
      );
    } catch {
      throw new ServiceError(
        '인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.',
        ServiceErrorCode.INTERNAL_SERVER_ERROR,
      );
    }

    await this.cacheService.set(cacheKey, code, 60 * 5);
  }

  async verifyEmailWithKey(cacheKey: string, code: number) {
    const cachedCode = await this.cacheService.find(cacheKey);

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

    await this.cacheService.del(cacheKey);
  }

  async verifyPhone(phone: string, code: number, redisKey?: RedisKey) {
    const cacheKey = redisKey ? `${redisKey}:${phone}` : phone;
    const cachedCode = await this.cacheService.find(cacheKey);

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

    await this.cacheService.del(cacheKey);
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

  async authPhone(redisKey: RedisKey, phone: string) {
    const code = Math.floor(100000 + Math.random() * 900000);

    const body = new URLSearchParams({
      username: Configuration.getConfig().TWSMS_USER,
      password: Configuration.getConfig().TWSMS_PASS,
      mobile: phone,
      longsms: 'Y',
      message: `
[SeoulMoment]
驗證碼:${code}
5分鐘內有效,請勿提供給他人。若非本人操作請忽略.`,
    });

    await this.httpService.sendPostRequest(
      `${Configuration.getConfig().TWSMS_API_URL}/sms_send.php`,
      body,
      {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    );

    await this.cacheService.set(`${redisKey}:${phone}`, code, 60 * 5);
  }
}

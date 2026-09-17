import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Configuration } from '@app/config/configuration';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

/** Bot 서버와 나눠 갖는 시크릿을 싣는 헤더 */
export const LINE_BOT_KEY_HEADER = 'x-line-bot-key';

/**
 * LINE Bot 전용 API 가드.
 *
 * 이 API 들은 lineUserId + email 만으로 회원을 찾아 로그인 토큰을 내주므로,
 * 공개된 채로 두면 두 값을 아는 쪽이 계정을 가져갈 수 있다. 호출자는 파트너
 * Bot 서버 하나뿐이라 서버끼리 나눠 갖는 시크릿으로 막는다.
 *
 * 키가 설정되지 않은 환경에서는 통과시키지 않는다 — 설정을 빠뜨린 배포가
 * 조용히 열린 채로 뜨는 것이 가장 위험하다.
 */
@Injectable()
export class LineBotKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const configured = Configuration.getConfig().LINE_BOT_API_KEY;

    if (!configured) {
      throw new ServiceError(
        'LINE_BOT_API_KEY 환경 변수가 설정되지 않았습니다.',
        ServiceErrorCode.INTERNAL_SERVER_ERROR,
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers[LINE_BOT_KEY_HEADER];

    if (typeof provided !== 'string' || !this.matches(configured, provided)) {
      throw new ServiceError(
        'LINE Bot 인증 키가 올바르지 않습니다.',
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    return true;
  }

  /** 길이가 달라도 시간이 새지 않도록 비교 전에 같은 길이로 맞춘다 */
  private matches(configured: string, provided: string): boolean {
    const expected = Buffer.from(configured);
    const actual = Buffer.from(provided);

    if (expected.length !== actual.length) {
      return false;
    }

    return timingSafeEqual(expected, actual);
  }
}

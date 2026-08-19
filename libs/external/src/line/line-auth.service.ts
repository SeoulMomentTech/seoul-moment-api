import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Configuration } from '@app/config/configuration';
import { HttpRequestService } from '@app/http/http.service';
import { Injectable } from '@nestjs/common';

export interface LineIdTokenPayload {
  /** LINE 계정 고유 ID (sub) */
  providerUserId: string;
  /** LINE 계정 이메일 */
  email: string;
  /** 이메일 인증 여부 */
  emailVerified: boolean;
}

/** LINE id_token verify 엔드포인트 응답 (필요한 필드만) */
interface LineVerifyResponse {
  sub: string;
  email?: string;
}

const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';

/**
 * @description
 * LINE Login id_token을 검증하여 계정 정보를 추출한다.
 * 클라이언트(LINE Login SDK/LIFF)에서 받은 id_token을 LINE verify
 * 엔드포인트로 보내 서명/만료/aud(client_id)를 검증한 뒤 sub, email을 반환한다.
 *
 * 이메일은 필수 정책이다. LINE 채널의 이메일 취득 권한 미승인 또는 사용자
 * 미동의로 email이 내려오지 않으면 로그인을 거부한다. LINE id_token에는
 * email_verified 클레임이 없으며 LINE이 자체적으로 이메일을 검증하므로
 * email이 존재하면 인증된 것으로 간주한다.
 *
 * 환경 변수: LINE_CHANNEL_ID (LINE Login 채널 ID = id_token aud = verify client_id)
 */
@Injectable()
export class ExternalLineAuthService {
  constructor(private readonly httpRequestService: HttpRequestService) {}

  async verifyIdToken(idToken: string): Promise<LineIdTokenPayload> {
    const channelId = Configuration.getConfig().LINE_CHANNEL_ID;

    if (!channelId) {
      throw new ServiceError(
        'LINE_CHANNEL_ID 환경 변수가 설정되지 않았습니다.',
        ServiceErrorCode.INTERNAL_SERVER_ERROR,
      );
    }

    const body = new URLSearchParams({
      id_token: idToken,
      client_id: channelId,
    });

    const data = await this.requestVerify(body);

    if (!data?.sub) {
      throw new ServiceError(
        '유효하지 않은 LINE idToken입니다.',
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    // 이메일은 필수다. 채널의 "이메일 취득 권한"이 승인된 상태이므로 email이
    // 없다는 것은 사용자가 동의 화면에서 이메일 제공을 거부했다는 뜻이다.
    // 이메일 없이 가입시키면 기존 계정과의 연결(link) 분기를 영구히 탈 수 없고
    // 메일 발송도 불가능하므로, 가입을 진행하지 않고 거부한다.
    if (!data.email) {
      throw new ServiceError(
        'LINE 계정의 이메일 제공에 동의해야 로그인할 수 있습니다.',
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    return {
      providerUserId: data.sub,
      email: data.email,
      emailVerified: true,
    };
  }

  /**
   * LINE verify 엔드포인트 호출. 만료/변조/aud 불일치 시 LINE은 400(invalid_request)을
   * 반환하는데, 이를 구글(google-auth-library가 인증 실패를 401로 던짐)과 동일하게
   * UNAUTHORIZED로 정규화한다. 5xx/네트워크 오류는 그대로 전파한다.
   */
  private async requestVerify(
    body: URLSearchParams,
  ): Promise<LineVerifyResponse> {
    try {
      const { data } =
        await this.httpRequestService.sendPostRequest<LineVerifyResponse>(
          LINE_VERIFY_URL,
          body,
          { 'Content-Type': 'application/x-www-form-urlencoded' },
        );

      return data;
    } catch (error) {
      if (
        error instanceof ServiceError &&
        error.getCode() === ServiceErrorCode.BAD_REQUEST
      ) {
        throw new ServiceError(
          '유효하지 않은 LINE idToken입니다.',
          ServiceErrorCode.UNAUTHORIZED,
        );
      }

      throw error;
    }
  }
}

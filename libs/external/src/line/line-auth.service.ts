import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Configuration } from '@app/config/configuration';
import { HttpRequestService } from '@app/http/http.service';
import { Injectable } from '@nestjs/common';

export interface LineIdTokenPayload {
  /** LINE 계정 고유 ID (sub) */
  providerUserId: string;
  /** LINE 계정 이메일. 사용자가 이메일 제공에 동의하지 않으면 null */
  email: string | null;
  /** 이메일 인증 여부 */
  emailVerified: boolean;
  /** LINE 표시 이름. profile scope 미동의 시 null */
  name: string | null;
  /** LINE 프로필 이미지 URL. profile scope 미동의 시 null */
  picture: string | null;
}

/** LINE id_token verify 엔드포인트 응답 (필요한 필드만) */
interface LineVerifyResponse {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';

/**
 * @description
 * LINE Login id_token을 검증하여 계정 정보를 추출한다.
 * 클라이언트(LINE Login SDK/LIFF)에서 받은 id_token을 LINE verify
 * 엔드포인트로 보내 서명/만료/aud(client_id)를 검증한 뒤 sub, email을 반환한다.
 *
 * 이메일은 선택이다. 채널의 이메일 취득 권한이 승인돼 있어도 사용자가 동의
 * 화면에서 항목별로 거부할 수 있다. 그 경우 email 을 null 로 반환하고,
 * 서비스가 직접 이메일을 입력받아 인증하는 흐름으로 넘긴다.
 * LINE id_token 에는 email_verified 클레임이 없으며 LINE 이 자체적으로
 * 이메일을 검증하므로 email 이 존재하면 인증된 것으로 간주한다.
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

    // 이메일은 사용자가 동의 화면에서 거부할 수 있다(채널 권한이 승인돼도
    // 항목별 거부가 가능하다). 여기서 막지 않고 null 로 넘긴다.
    // 이메일이 없으면 서비스가 직접 입력받아 인증하는 흐름으로 간다.
    return {
      providerUserId: data.sub,
      email: data.email ?? null,
      emailVerified: true,
      name: data.name ?? null,
      picture: data.picture ?? null,
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

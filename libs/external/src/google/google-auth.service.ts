import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Configuration } from '@app/config/configuration';
import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleIdTokenPayload {
  /** Google 계정 고유 ID (sub) */
  providerUserId: string;
  /** Google 계정 이메일 */
  email: string;
  /** 이메일 인증 여부 */
  emailVerified: boolean;
}

/**
 * @description
 * Google OAuth idToken을 검증하여 계정 정보를 추출한다.
 * 클라이언트(Google Sign-In)에서 받은 idToken의 서명/만료/audience를
 * 검증한 뒤 sub, email, email_verified를 반환한다.
 *
 * 환경 변수: GOOGLE_OAUTH_CLIENT_ID (Google Cloud Console OAuth 클라이언트 ID)
 */
@Injectable()
export class ExternalGoogleAuthService {
  private readonly oauthClient = new OAuth2Client();

  async verifyIdToken(idToken: string): Promise<GoogleIdTokenPayload> {
    const clientId = Configuration.getConfig().GOOGLE_OAUTH_CLIENT_ID;

    if (!clientId) {
      throw new ServiceError(
        'GOOGLE_OAUTH_CLIENT_ID 환경 변수가 설정되지 않았습니다.',
        ServiceErrorCode.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken,
        audience: clientId,
      });

      const payload = ticket.getPayload();

      if (!payload?.sub || !payload?.email) {
        throw new ServiceError(
          '유효하지 않은 Google idToken입니다.',
          ServiceErrorCode.UNAUTHORIZED,
        );
      }

      return {
        providerUserId: payload.sub,
        email: payload.email,
        emailVerified: !!payload.email_verified,
      };
    } catch (error) {
      if (error instanceof ServiceError) throw error;

      throw new ServiceError(
        `유효하지 않은 Google idToken입니다: ${error.message}`,
        ServiceErrorCode.UNAUTHORIZED,
      );
    }
  }
}

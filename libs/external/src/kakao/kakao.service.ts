import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { HttpRequestService } from '@app/http/http.service';
import { Injectable } from '@nestjs/common';

import { KakaoValidateTokenResponse } from './kakao.dto';

@Injectable()
export class KakaoService {
  private readonly kakaoUrl = 'https://kapi.kakao.com';

  constructor(private readonly httpRequestService: HttpRequestService) {}

  async validateToken(token: string): Promise<KakaoValidateTokenResponse> {
    const { result, data } =
      await this.httpRequestService.sendGetRequest<KakaoValidateTokenResponse>(
        `${this.kakaoUrl}/v1/user/access_token_info`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

    if (!result) {
      throw new ServiceError(
        'Failed to validate token',
        ServiceErrorCode.UNAUTHORIZED,
      );
    }

    return data;
  }
}

import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Configuration } from '@app/config/configuration';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { lastValueFrom } from 'rxjs';

import {
  LinePayRawResponse,
  LinePayRequestInfo,
  LinePayRequestInput,
  LinePayRequestResultDto,
  LinePayResultDto,
} from './linepay.dto';
import { createLinePaySignature, parseLinePayJson } from './linepay.signature';

/** Confirm 은 40초 이상 기다리라고 문서가 권한다 */
const CONFIRM_TIMEOUT_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * LINE Pay Online API v3 클라이언트.
 *
 * 응답을 문자열 그대로 받아 parseLinePayJson 으로 읽는다. axios 기본 JSON 파싱을
 * 쓰면 19자리 transactionId 가 깨진다.
 * 네트워크 오류·타임아웃은 ServiceError 로 던진다. 이 경우 결과를 모르는 것이므로
 * 호출하는 쪽이 checkStatus 로 다시 확인해야 한다.
 */
@Injectable()
export class ExternalLinePayService {
  private readonly logger = new Logger(ExternalLinePayService.name);

  constructor(private readonly httpService: HttpService) {}

  async request(input: LinePayRequestInput): Promise<LinePayRequestResultDto> {
    const body = {
      amount: input.amount,
      currency: 'TWD',
      orderId: input.orderId,
      packages: [
        {
          id: input.packageId,
          amount: input.amount,
          products: input.products,
        },
      ],
      redirectUrls: {
        confirmUrl: input.confirmUrl,
        cancelUrl: input.cancelUrl,
      },
    };

    const response = await this.send<LinePayRequestInfo>(
      'POST',
      '/v3/payments/request',
      body,
    );

    return LinePayRequestResultDto.from(response);
  }

  async confirm(
    transactionId: string,
    amount: number,
  ): Promise<LinePayResultDto> {
    const response = await this.send(
      'POST',
      `/v3/payments/${transactionId}/confirm`,
      { amount, currency: 'TWD' },
      CONFIRM_TIMEOUT_MS,
    );

    return LinePayResultDto.from(response);
  }

  async checkStatus(transactionId: string): Promise<LinePayResultDto> {
    const response = await this.send(
      'GET',
      `/v3/payments/requests/${transactionId}/check`,
    );

    return LinePayResultDto.from(response);
  }

  private async send<T = unknown>(
    method: 'GET' | 'POST',
    apiPath: string,
    body?: Record<string, unknown>,
    timeout = DEFAULT_TIMEOUT_MS,
  ): Promise<LinePayRawResponse<T>> {
    const { channelId, channelSecret, apiUrl } = this.getCredentials();
    const payload = body ? JSON.stringify(body) : '';
    const nonce = randomUUID();

    try {
      const { data } = await lastValueFrom(
        this.httpService.request<string>({
          method,
          url: `${apiUrl}${apiPath}`,
          data: method === 'POST' ? payload : undefined,
          headers: {
            'Content-Type': 'application/json',
            'X-LINE-ChannelId': channelId,
            'X-LINE-Authorization-Nonce': nonce,
            'X-LINE-Authorization': createLinePaySignature(
              channelSecret,
              apiPath,
              payload,
              nonce,
            ),
          },
          responseType: 'text',
          transformResponse: [(raw: string) => raw],
          timeout,
        }),
      );

      return parseLinePayJson<LinePayRawResponse<T>>(String(data));
    } catch (error) {
      this.logger.error(`LINE Pay ${method} ${apiPath} failed: ${error}`);

      throw new ServiceError(
        `LINE Pay 호출 실패: ${apiPath}`,
        ServiceErrorCode.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private getCredentials() {
    const config = Configuration.getConfig();

    if (!config.LINE_PAY_CHANNEL_ID || !config.LINE_PAY_CHANNEL_SECRET) {
      throw new ServiceError(
        'LINE Pay 설정(LINE_PAY_CHANNEL_ID / CHANNEL_SECRET)이 비어 있습니다.',
        ServiceErrorCode.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      channelId: config.LINE_PAY_CHANNEL_ID,
      channelSecret: config.LINE_PAY_CHANNEL_SECRET,
      apiUrl: config.LINE_PAY_API_URL,
    };
  }
}

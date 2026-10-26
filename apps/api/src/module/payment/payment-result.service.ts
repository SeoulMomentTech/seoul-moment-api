import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Configuration } from '@app/config/configuration';
import { PaymentEntity } from '@app/repository/entity/payment.entity';
import { OrderRepositoryService } from '@app/repository/service/order.repository.service';
import { PaymentRepositoryService } from '@app/repository/service/payment.repository.service';
import { Injectable } from '@nestjs/common';
import { Response } from 'express';

import { RESULT_TOKEN_TTL_DAYS } from './payment.constant';
import { GetPaymentResultResponse } from './payment.dto';
import { renderResultPage } from './payment.html';

/**
 * 결제 결과 페이지로 가는 길과, 로그인 없이 보는 결과 조회.
 *
 * LINE 안에서 외부 브라우저로 넘겨 결제한 사용자는 그 브라우저에 로그인 토큰이 없다.
 * 그래서 결과는 결제 시도마다 발급한 access_token 으로만 연다.
 */
@Injectable()
export class PaymentResultService {
  constructor(
    private readonly paymentRepositoryService: PaymentRepositoryService,
    private readonly orderRepositoryService: OrderRepositoryService,
  ) {}

  callbackUrl(path: string): string {
    return `${Configuration.getConfig().PAYMENT_CALLBACK_BASE_URL}${path}`;
  }

  handoffUrl(payment: PaymentEntity): string {
    return this.callbackUrl(`/payment/ecpay/handoff/${payment.accessToken}`);
  }

  async getResult(token: string): Promise<GetPaymentResultResponse> {
    const result = await this.findResult(token);

    if (!result) {
      throw new ServiceError(
        'No exist payment result for the token',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

  /**
   * 브라우저를 결과 화면으로 보낸다. 프론트 주소가 설정돼 있으면 그쪽 결과 페이지로
   * 303(POST → GET), 아니면 서버가 그린 간단한 결과 페이지를 준다.
   */
  async respond(res: Response, payment: PaymentEntity | null): Promise<void> {
    const storefront = Configuration.getConfig().STOREFRONT_BASE_URL;

    if (payment && storefront) {
      res.redirect(
        303,
        `${storefront}/payment/result?h=${encodeURIComponent(payment.accessToken)}`,
      );

      return;
    }

    const result = payment ? await this.findResult(payment.accessToken) : null;

    res.status(200).type('html').send(renderResultPage(result));
  }

  private async findResult(
    token: string,
  ): Promise<GetPaymentResultResponse | null> {
    const payment =
      await this.paymentRepositoryService.findByAccessToken(token);

    if (!payment || this.isExpired(payment)) {
      return null;
    }

    const order = await this.orderRepositoryService.findById(payment.orderId);

    return order ? GetPaymentResultResponse.from(order, payment) : null;
  }

  private isExpired(payment: PaymentEntity): boolean {
    if (!payment.requestedAt) {
      return false;
    }

    const ttlMs = RESULT_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

    return payment.requestedAt.getTime() + ttlMs < Date.now();
  }
}

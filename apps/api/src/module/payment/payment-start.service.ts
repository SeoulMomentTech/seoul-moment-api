import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Configuration } from '@app/config/configuration';
import { SupportEnv } from '@app/config/enum/config.enum';
import { OrderEntity } from '@app/repository/entity/order.entity';
import { PaymentEntity } from '@app/repository/entity/payment.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { OrderStatus, PaymentMethod } from '@app/repository/enum/order.enum';
import { PaymentStatus } from '@app/repository/enum/payment.enum';
import { OrderRepositoryService } from '@app/repository/service/order.repository.service';
import { PaymentRepositoryService } from '@app/repository/service/payment.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import { LinePayPaymentService } from './linepay-payment.service';
import { PaymentResultService } from './payment-result.service';
import { PostUserPaymentResponse } from './payment.dto';
import { buildMerchantTradeNo, createPaymentAccessToken } from './payment.util';
import { StockReservationService } from './stock-reservation.service';

/**
 * 결제 시작 (POST /user/order/:id/payment).
 *
 * 한 트랜잭션에서 주문을 잠그고 → 이전 시도를 밀어내고 → 재고를 잡고 → 새 시도를 만든다.
 * 재고가 모자라면 PG 로 넘기지 않으니 돈이 빠질 일이 없다.
 * LINE Pay 요청(외부 HTTP)은 트랜잭션이 끝난 뒤에 한다 — 주문 잠금을 붙든 채 기다리지 않는다.
 */
@Injectable()
export class PaymentStartService {
  constructor(
    private readonly orderRepositoryService: OrderRepositoryService,
    private readonly paymentRepositoryService: PaymentRepositoryService,
    private readonly stockReservationService: StockReservationService,
    private readonly linePayPaymentService: LinePayPaymentService,
    private readonly paymentResultService: PaymentResultService,
  ) {}

  async start(
    userId: number,
    orderId: number,
    language?: LanguageCode,
  ): Promise<PostUserPaymentResponse> {
    const payment = await this.prepare(userId, orderId, language);

    if (payment.method === PaymentMethod.LINE_PAY) {
      return this.linePayPaymentService.request(payment);
    }

    return PostUserPaymentResponse.ecpay(
      payment,
      this.paymentResultService.handoffUrl(payment),
    );
  }

  @Transactional()
  private async prepare(
    userId: number,
    orderId: number,
    language?: LanguageCode,
  ): Promise<PaymentEntity> {
    const order = await this.lockPayableOrder(userId, orderId);

    await this.supersedeActiveAttempts(order.id);
    await this.stockReservationService.reserve(order);

    const payment = await this.paymentRepositoryService.save(
      plainToInstance(PaymentEntity, {
        orderId: order.id,
        method: order.paymentMethod,
        status: PaymentStatus.READY,
        amount: order.totalAmount,
        accessToken: createPaymentAccessToken(),
        locale: language ?? null,
        // READY 로 남은 시도를 배치가 찾을 수 있게 만든 시각을 둔다 (PG 로 넘기면 다시 찍는다)
        requestedAt: new Date(),
      }),
    );

    const config = Configuration.getConfig();
    payment.merchantTradeNo = buildMerchantTradeNo(
      config.PAYMENT_TRADE_NO_PREFIX,
      payment.id,
      config.NODE_ENV === SupportEnv.PROD,
    );
    await this.paymentRepositoryService.updateMerchantTradeNo(
      payment.id,
      payment.merchantTradeNo,
    );

    // ECPay 는 여기서 바로 결제창으로 넘긴다. LINE Pay 는 요청이 성공해야 REQUESTED 다
    if (payment.method === PaymentMethod.ECPAY) {
      payment.status = PaymentStatus.REQUESTED;
      payment.requestedAt = new Date();
      await this.paymentRepositoryService.save(payment);
    }

    return payment;
  }

  private async lockPayableOrder(
    userId: number,
    orderId: number,
  ): Promise<OrderEntity> {
    const order = await this.orderRepositoryService.findByIdForUpdate(orderId);

    if (!order || order.userId !== userId) {
      throw new ServiceError(
        `No exist order ID: ${orderId}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new ServiceError(
        `Order is not payable: status=${order.status}`,
        ServiceErrorCode.CONFLICT,
      );
    }

    if (!order.paymentMethod) {
      throw new ServiceError(
        'Order has no payment method',
        ServiceErrorCode.BAD_REQUEST,
      );
    }

    return order;
  }

  /**
   * 결제창에서 이탈한 뒤 다시 결제하는 경우다. 이전 시도는 취소로 닫되 재고는 돌려주지
   * 않는다 — 곧바로 새 시도가 이어받는다. 이전 시도에 늦게 돈이 들어오면 markPaid 가
   * 받아들인다.
   */
  private async supersedeActiveAttempts(orderId: number) {
    const active =
      await this.paymentRepositoryService.findActiveByOrderId(orderId);

    for (const payment of active) {
      payment.status = PaymentStatus.CANCELED;
      payment.failureCode = 'SUPERSEDED';
      await this.paymentRepositoryService.save(payment);
    }
  }
}

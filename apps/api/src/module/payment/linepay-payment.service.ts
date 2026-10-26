import { RedisKey } from '@app/cache/cache.dto';
import { CacheService } from '@app/cache/cache.service';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import {
  LinePayCheckCode,
  LinePayProduct,
  LinePayRequestResultDto,
  LinePayResultDto,
} from '@app/external/linepay/linepay.dto';
import { ExternalLinePayService } from '@app/external/linepay/linepay.service';
import { PaymentEntity } from '@app/repository/entity/payment.entity';
import { PaymentMethod } from '@app/repository/enum/order.enum';
import {
  PaymentEventSource,
  PaymentStatus,
} from '@app/repository/enum/payment.enum';
import { OrderRepositoryService } from '@app/repository/service/order.repository.service';
import { PaymentRepositoryService } from '@app/repository/service/payment.repository.service';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PaymentCompletionService } from './payment-completion.service';
import { PaymentResultService } from './payment-result.service';
import {
  ABANDON_AFTER_MINUTES,
  LINEPAY_CONFIRM_LOCK_SECONDS,
  LINEPAY_FORCE_EXPIRE_HOURS,
} from './payment.constant';
import { PostUserPaymentResponse } from './payment.dto';
import { minutesAgo } from './payment.util';

/** LINE Pay 상품명 길이 상한을 넉넉히 밑돈다 */
const PRODUCT_NAME_MAX = 100;

/**
 * LINE Pay 흐름. 서버→서버 통지가 없어서 결제 확정은 두 길로만 온다.
 * - 사용자가 승인 후 confirmUrl 로 돌아왔을 때 (confirm)
 * - 돌아오지 않았을 때 배치가 상태 조회로 회수 (reconcile)
 */
@Injectable()
export class LinePayPaymentService {
  private readonly logger = new Logger(LinePayPaymentService.name);

  constructor(
    private readonly linePayService: ExternalLinePayService,
    private readonly paymentRepositoryService: PaymentRepositoryService,
    private readonly orderRepositoryService: OrderRepositoryService,
    private readonly paymentCompletionService: PaymentCompletionService,
    private readonly paymentResultService: PaymentResultService,
    private readonly cacheService: CacheService,
  ) {}

  /** 결제 시작. 실패하면 시도를 FAILED 로 닫고(재고 복구) 에러를 던진다 */
  async request(payment: PaymentEntity): Promise<PostUserPaymentResponse> {
    const result = await this.sendRequest(payment);

    await this.paymentRepositoryService.saveEvent(
      payment.id,
      PaymentEventSource.LINEPAY_REQUEST,
      {
        returnCode: result.returnCode,
        returnMessage: result.returnMessage,
        transactionId: result.transactionId,
      },
    );

    if (!result.isSuccess()) {
      await this.fail(payment, result.returnCode, result.returnMessage);

      throw new ServiceError(
        `LINE Pay request failed: ${result.returnCode} ${result.returnMessage}`,
        ServiceErrorCode.INTERNAL_SERVER_ERROR,
      );
    }

    // 그 사이 다른 탭이 새 시도를 시작했다면 이 시도는 이미 취소됐다 — 되살리지 않는다
    const moved = await this.paymentRepositoryService.markRequested(
      payment.id,
      result.transactionId,
    );

    if (!moved) {
      throw new ServiceError(
        'Payment attempt was superseded by a newer one',
        ServiceErrorCode.CONFLICT,
      );
    }

    payment.status = PaymentStatus.REQUESTED;
    payment.pgTransactionId = result.transactionId;

    return PostUserPaymentResponse.linePay(
      payment,
      result.paymentUrlWeb,
      result.paymentUrlApp,
    );
  }

  /** 상품 목록 만들기부터 호출까지 어디서 실패해도 시도를 닫는다 — READY 로 남기지 않는다 */
  private async sendRequest(
    payment: PaymentEntity,
  ): Promise<LinePayRequestResultDto> {
    try {
      return await this.linePayService.request({
        orderId: payment.merchantTradeNo,
        amount: payment.amount,
        packageId: String(payment.orderId),
        products: await this.buildProducts(payment.orderId),
        confirmUrl: this.paymentResultService.callbackUrl(
          '/payment/linepay/confirm',
        ),
        cancelUrl: this.paymentResultService.callbackUrl(
          '/payment/linepay/cancel',
        ),
      });
    } catch (error) {
      await this.fail(payment, 'REQUEST_ERROR', String(error));
      throw error;
    }
  }

  /**
   * confirmUrl. 거래번호·transactionId 가 우리 시도와 맞고 아직 결제 중일 때만 확정한다.
   * 새로고침으로 두 번 와도 락으로 한 번만 확정한다.
   */
  async confirm(
    orderId: string,
    transactionId: string,
  ): Promise<PaymentEntity | null> {
    const payment = await this.findOwnPayment(orderId, transactionId);

    if (!payment || payment.status !== PaymentStatus.REQUESTED) {
      return payment;
    }

    return this.confirmLocked(payment, true);
  }

  /** cancelUrl. 사용자가 LINE Pay 결제 화면에서 취소했다 */
  async cancel(
    orderId: string,
    transactionId: string,
  ): Promise<PaymentEntity | null> {
    const payment = await this.findOwnPayment(orderId, transactionId);

    if (!payment || payment.status !== PaymentStatus.REQUESTED) {
      return payment;
    }

    await this.paymentRepositoryService.saveEvent(
      payment.id,
      PaymentEventSource.LINEPAY_CANCEL,
      { orderId, transactionId },
    );

    return this.paymentCompletionService.failAttempt(
      payment.id,
      PaymentStatus.CANCELED,
      { code: 'USER_CANCELED' },
    );
  }

  /** confirmUrl 로 돌아오지 않은 시도 (배치) */
  async reconcile(payment: PaymentEntity, now: Date = new Date()) {
    const check = await this.checkStatus(payment);

    if (!check) {
      return this.expireIfUnreachable(payment, now);
    }

    switch (check.returnCode) {
      case LinePayCheckCode.AUTHORIZED:
        return this.confirmLocked(payment, false);
      case LinePayCheckCode.COMPLETED:
        return this.paymentCompletionService.markPaid(payment.id, {
          pgTransactionId: payment.pgTransactionId,
          pgPaymentType: PaymentMethod.LINE_PAY,
        });
      case LinePayCheckCode.CANCELED_OR_EXPIRED:
        return this.close(payment, PaymentStatus.EXPIRED, check);
      case LinePayCheckCode.FAILED:
        return this.close(payment, PaymentStatus.FAILED, check);
      default:
        return this.expireIfAbandoned(payment, now);
    }
  }

  /**
   * 사용자의 confirmUrl 과 배치가 같은 시도를 동시에 Confirm 하지 않게 한다.
   * 락을 잡은 뒤 다시 읽어 아직 결제 중일 때만 확정한다.
   */
  private async confirmLocked(
    payment: PaymentEntity,
    allowRetry: boolean,
  ): Promise<PaymentEntity> {
    const key = `${RedisKey.LINEPAY_CONFIRM_LOCK}:${payment.id}`;
    const owner = randomUUID();
    const locked = await this.cacheService.setIfAbsent(
      key,
      owner,
      LINEPAY_CONFIRM_LOCK_SECONDS,
    );

    if (!locked) {
      return payment;
    }

    try {
      const fresh = await this.paymentRepositoryService.findById(payment.id);

      if (!fresh || fresh.status !== PaymentStatus.REQUESTED) {
        return fresh ?? payment;
      }

      return await this.confirmAndComplete(fresh, allowRetry);
    } finally {
      await this.cacheService.deleteIfValue(key, owner).catch(() => undefined);
    }
  }

  /**
   * Confirm 결과를 모르면(타임아웃 등) 실패로 단정하지 않고 상태 조회로 다시 확인한다.
   * allowRetry=false 면 조회 결과가 "승인됨"이어도 다시 Confirm 하지 않는다 — 무한 반복 방지.
   */
  private async confirmAndComplete(
    payment: PaymentEntity,
    allowRetry = true,
  ): Promise<PaymentEntity> {
    let result: LinePayResultDto;

    try {
      result = await this.linePayService.confirm(
        payment.pgTransactionId,
        payment.amount,
      );
    } catch (error) {
      this.logger.warn(
        `LINE Pay confirm unknown: paymentId=${payment.id} ${error}`,
      );

      return allowRetry ? this.reconcileAfterUnknown(payment) : payment;
    }

    await this.paymentRepositoryService.saveEvent(
      payment.id,
      PaymentEventSource.LINEPAY_CONFIRM,
      { returnCode: result.returnCode, returnMessage: result.returnMessage },
    );

    if (result.isSuccess()) {
      return this.paymentCompletionService.markPaid(payment.id, {
        pgTransactionId: payment.pgTransactionId,
        pgPaymentType: PaymentMethod.LINE_PAY,
      });
    }

    return this.settleAfterRejected(payment, result);
  }

  /**
   * Confirm 이 0000 이 아니어도 실패로 단정하지 않는다 — "이미 확정됨" 같은 응답일 수 있다.
   * 상태 조회로 완료면 PAID, 취소·만료·실패(0121/0122)면 닫고, 그 밖(승인 상태·LINE Pay
   * 내부 오류·조회 실패)은 결제 중으로 둬 배치가 다시 본다.
   */
  private async settleAfterRejected(
    payment: PaymentEntity,
    result: LinePayResultDto,
  ): Promise<PaymentEntity> {
    const check = await this.checkStatus(payment);

    if (check?.returnCode === LinePayCheckCode.COMPLETED) {
      return this.paymentCompletionService.markPaid(payment.id, {
        pgTransactionId: payment.pgTransactionId,
        pgPaymentType: PaymentMethod.LINE_PAY,
      });
    }

    if (check?.returnCode === LinePayCheckCode.CANCELED_OR_EXPIRED) {
      return this.close(payment, PaymentStatus.EXPIRED, result);
    }

    if (check?.returnCode === LinePayCheckCode.FAILED) {
      return this.close(payment, PaymentStatus.FAILED, result);
    }

    return payment;
  }

  private async reconcileAfterUnknown(payment: PaymentEntity) {
    const check = await this.checkStatus(payment);

    if (check?.returnCode === LinePayCheckCode.COMPLETED) {
      return this.paymentCompletionService.markPaid(payment.id, {
        pgTransactionId: payment.pgTransactionId,
        pgPaymentType: PaymentMethod.LINE_PAY,
      });
    }

    // 아직 승인 상태로 남아 있으면 배치가 다시 확인한다
    return payment;
  }

  private async checkStatus(
    payment: PaymentEntity,
  ): Promise<LinePayResultDto | null> {
    if (!payment.pgTransactionId) {
      return null;
    }

    try {
      const check = await this.linePayService.checkStatus(
        payment.pgTransactionId,
      );
      await this.paymentRepositoryService.saveEvent(
        payment.id,
        PaymentEventSource.LINEPAY_CHECK,
        { returnCode: check.returnCode, returnMessage: check.returnMessage },
      );

      return check;
    } catch {
      return null;
    }
  }

  /**
   * LINE Pay 조회가 계속 안 되는 동안 시도가 재고를 영영 붙들지 않게 한다.
   * 승인은 몇 분이면 소멸하므로 이만큼 지나도록 모르면 결제되지 않은 것으로 본다.
   */
  private async expireIfUnreachable(payment: PaymentEntity, now: Date) {
    const forceAt = minutesAgo(LINEPAY_FORCE_EXPIRE_HOURS * 60, now);

    if (payment.requestedAt && payment.requestedAt > forceAt) {
      return payment;
    }

    return this.paymentCompletionService.failAttempt(
      payment.id,
      PaymentStatus.EXPIRED,
      { code: 'CHECK_UNAVAILABLE' },
    );
  }

  private async expireIfAbandoned(payment: PaymentEntity, now: Date) {
    const abandoned =
      !payment.requestedAt ||
      payment.requestedAt < minutesAgo(ABANDON_AFTER_MINUTES, now);

    if (!abandoned) {
      return payment;
    }

    return this.paymentCompletionService.failAttempt(
      payment.id,
      PaymentStatus.EXPIRED,
      { code: 'ABANDONED' },
    );
  }

  private close(
    payment: PaymentEntity,
    status: PaymentStatus.FAILED | PaymentStatus.EXPIRED,
    result: LinePayResultDto,
  ) {
    return this.paymentCompletionService.failAttempt(payment.id, status, {
      code: result.returnCode,
      message: result.returnMessage,
    });
  }

  private fail(payment: PaymentEntity, code: string, message: string) {
    return this.paymentCompletionService.failAttempt(
      payment.id,
      PaymentStatus.FAILED,
      { code, message },
    );
  }

  /** orderId(우리 거래번호)와 transactionId 가 같은 LINE Pay 시도인지 확인한다 */
  private async findOwnPayment(
    orderId: string,
    transactionId: string,
  ): Promise<PaymentEntity | null> {
    const payment =
      await this.paymentRepositoryService.findByMerchantTradeNo(orderId);

    if (
      !payment ||
      payment.method !== PaymentMethod.LINE_PAY ||
      payment.pgTransactionId !== transactionId
    ) {
      this.logger.warn(
        `LINE Pay redirect mismatch: orderId=${orderId} transactionId=${transactionId}`,
      );

      return null;
    }

    return payment;
  }

  /** products 합이 결제 금액과 같아야 한다. 배송비는 별도 라인으로 넣는다 */
  private async buildProducts(orderId: number): Promise<LinePayProduct[]> {
    const order = await this.orderRepositoryService.findById(orderId);
    const items = await this.orderRepositoryService.findItemsByOrderId(orderId);

    const products: LinePayProduct[] = items.map((item) => {
      const name = [item.productNameSnapshot, item.optionTextSnapshot]
        .filter(Boolean)
        .join(' / ');

      return {
        // 이모지 같은 서로게이트 쌍을 반으로 자르지 않게 코드 포인트로 자른다
        name: Array.from(name).slice(0, PRODUCT_NAME_MAX).join('') || 'Item',
        quantity: item.quantity,
        price: item.unitDiscountPrice,
      };
    });

    if (order && order.shippingFeeApplied > 0) {
      products.push({
        name: '運費',
        quantity: 1,
        price: order.shippingFeeApplied,
      });
    }

    return products;
  }
}

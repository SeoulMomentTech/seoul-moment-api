import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { OrderEntity } from '@app/repository/entity/order.entity';
import {
  PaymentDepositInfo,
  PaymentEntity,
} from '@app/repository/entity/payment.entity';
import { OrderStatus } from '@app/repository/enum/order.enum';
import {
  PaymentEventSource,
  PaymentStatus,
} from '@app/repository/enum/payment.enum';
import { CartRepositoryService } from '@app/repository/service/cart.repository.service';
import { OrderRepositoryService } from '@app/repository/service/order.repository.service';
import { PaymentRepositoryService } from '@app/repository/service/payment.repository.service';
import { Injectable, Logger } from '@nestjs/common';
import { runOnTransactionCommit, Transactional } from 'typeorm-transactional';

import { StockReservationService } from './stock-reservation.service';
import { InvoiceIssueService } from '../invoice/invoice-issue.service';

export interface PaidInfo {
  pgTransactionId?: string | null;
  pgPaymentType?: string | null;
  paidAt?: Date | null;
}

export interface WaitingDepositInfo {
  pgTransactionId?: string | null;
  pgPaymentType: string;
  depositInfo: PaymentDepositInfo;
  expireAt: Date | null;
}

export interface FailureInfo {
  code?: string | null;
  message?: string | null;
}

type FailedStatus =
  | PaymentStatus.FAILED
  | PaymentStatus.CANCELED
  | PaymentStatus.EXPIRED;

/**
 * 결제 시도·주문 상태 전이를 한 곳에 모은다. ECPay·LINE Pay·배치가 모두 여기를 거친다.
 *
 * 잠금 순서는 항상 주문 → 결제 시도다. 결제 시작(주문을 잠그고 이전 시도를 정리)과
 * 콜백이 겹쳐도 교착이 나지 않게 하려고 순서를 고정한다.
 * 모든 전이는 멱등이다. 콜백 재전송·배치 회수·브라우저 새로고침이 겹쳐도 한 번만 반영된다.
 */
@Injectable()
export class PaymentCompletionService {
  private readonly logger = new Logger(PaymentCompletionService.name);

  constructor(
    private readonly paymentRepositoryService: PaymentRepositoryService,
    private readonly orderRepositoryService: OrderRepositoryService,
    private readonly cartRepositoryService: CartRepositoryService,
    private readonly stockReservationService: StockReservationService,
    private readonly invoiceIssueService: InvoiceIssueService,
  ) {}

  /**
   * PG 가 결제 완료를 알려 왔을 때. 이미 취소·만료로 정리한 시도라도 돈이 들어왔다면
   * 받아들인다 — 다른 탭에서 늦게 결제했거나 배치가 먼저 만료시킨 경우다.
   */
  @Transactional()
  async markPaid(paymentId: number, paid: PaidInfo): Promise<PaymentEntity> {
    const { order, payment } = await this.lock(paymentId);

    if (payment.status === PaymentStatus.PAID) {
      return payment;
    }

    payment.status = PaymentStatus.PAID;
    payment.paidAt = paid.paidAt ?? new Date();
    payment.pgTransactionId = paid.pgTransactionId ?? payment.pgTransactionId;
    payment.pgPaymentType = paid.pgPaymentType ?? payment.pgPaymentType;
    payment.failureCode = null;
    payment.failureMessage = null;
    await this.paymentRepositoryService.save(payment);

    if (order.status === OrderStatus.PAID) {
      await this.needsAttention(
        payment,
        'DUPLICATE_PAYMENT — 다른 시도로 이미 결제된 주문. 환불 필요',
      );

      return payment;
    }

    const hasStock = await this.stockReservationService.tryReserve(order);

    if (!hasStock) {
      await this.orderRepositoryService.updateOrder(order.id, {
        status: OrderStatus.FAILED,
        paidAt: payment.paidAt,
      });
      await this.needsAttention(
        payment,
        'OUT_OF_STOCK_AFTER_PAYMENT — 결제 후 재고 부족. 환불 필요',
      );

      return payment;
    }

    await this.orderRepositoryService.updateOrder(order.id, {
      status: OrderStatus.PAID,
      paidAt: payment.paidAt,
    });
    await this.clearOrderedCartItems(order);
    this.issueInvoiceAfterCommit(order.id);

    return payment;
  }

  /**
   * 대만 영업세법상 선결제 판매는 대금을 받은 시점에 발표를 발행해야 한다.
   * 커밋 뒤에 돌려 결제 확정이 발표 발행 실패에 끌려가지 않게 한다. 실패분은 배치가 다시 시도한다.
   */
  private issueInvoiceAfterCommit(orderId: number) {
    runOnTransactionCommit(() => {
      this.invoiceIssueService
        .issueForOrder(orderId)
        .catch((error) =>
          this.logger.error(
            `invoice issue failed: orderId=${orderId} ${error}`,
          ),
        );
    });
  }

  /** ECPay ATM·편의점 번호 발급(取號). 재고는 결제 시작 때 잡은 그대로 둔다 */
  @Transactional()
  async markWaitingDeposit(
    paymentId: number,
    info: WaitingDepositInfo,
  ): Promise<PaymentEntity> {
    const { order, payment } = await this.lock(paymentId);

    if (
      payment.status !== PaymentStatus.REQUESTED &&
      payment.status !== PaymentStatus.READY
    ) {
      return payment;
    }

    payment.status = PaymentStatus.WAITING_DEPOSIT;
    payment.pgTransactionId = info.pgTransactionId ?? payment.pgTransactionId;
    payment.pgPaymentType = info.pgPaymentType;
    payment.depositInfo = info.depositInfo;
    payment.expireAt = info.expireAt;
    await this.paymentRepositoryService.save(payment);

    if (order.status === OrderStatus.PENDING) {
      await this.orderRepositoryService.updateOrder(order.id, {
        status: OrderStatus.PAYMENT_WAITING,
      });
    }

    return payment;
  }

  /**
   * 시도가 결제 없이 끝났을 때. 남은 진행 중 시도가 없으면 재고를 돌려준다.
   * 입금 대기였던 주문이 기한을 넘기면 주문도 취소한다.
   * 결제 시작 화면에서 이전 시도를 밀어낼 때는 쓰지 않는다 — 곧 새 시도가 재고를 이어받는다.
   */
  @Transactional()
  async failAttempt(
    paymentId: number,
    status: FailedStatus,
    failure: FailureInfo = {},
  ): Promise<PaymentEntity> {
    const { order, payment } = await this.lock(paymentId);

    if (payment.isTerminal()) {
      return payment;
    }

    payment.status = status;
    payment.failureCode = failure.code?.slice(0, 50) ?? null;
    payment.failureMessage = failure.message?.slice(0, 255) ?? null;
    await this.paymentRepositoryService.save(payment);

    await this.releaseIfIdle(order, payment.id);

    return payment;
  }

  /** 결제 없이 오래 남은 PENDING 주문을 취소한다 (배치) */
  @Transactional()
  async cancelStaleOrder(orderId: number): Promise<void> {
    const order = await this.orderRepositoryService.findByIdForUpdate(orderId);

    if (!order || order.status !== OrderStatus.PENDING) {
      return;
    }

    const active =
      await this.paymentRepositoryService.findActiveByOrderId(orderId);

    if (active.length > 0) {
      return;
    }

    await this.stockReservationService.release(order);
    await this.orderRepositoryService.updateOrder(order.id, {
      status: OrderStatus.CANCELED,
    });
  }

  private async releaseIfIdle(order: OrderEntity, paymentId: number) {
    const remaining =
      await this.paymentRepositoryService.countActiveByOrderIdExcept(
        order.id,
        paymentId,
      );

    if (remaining > 0) {
      return;
    }

    if (order.status === OrderStatus.PENDING) {
      await this.stockReservationService.release(order);
    } else if (order.status === OrderStatus.PAYMENT_WAITING) {
      await this.stockReservationService.release(order);
      await this.orderRepositoryService.updateOrder(order.id, {
        status: OrderStatus.CANCELED,
      });
    }
  }

  /** 주문 → 결제 시도 순으로 잠근다 (클래스 주석 참고) */
  private async lock(
    paymentId: number,
  ): Promise<{ order: OrderEntity; payment: PaymentEntity }> {
    const target = await this.paymentRepositoryService.findById(paymentId);

    if (!target) {
      throw new ServiceError(
        `No exist payment ID: ${paymentId}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    const order = await this.orderRepositoryService.findByIdForUpdate(
      target.orderId,
    );
    const payment =
      await this.paymentRepositoryService.findByIdForUpdate(paymentId);

    if (!order || !payment) {
      throw new ServiceError(
        `No exist order for payment ID: ${paymentId}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return { order, payment };
  }

  /** 결제 성공 후 주문에 쓴 장바구니 라인만 지운다. "구매하기" 주문은 지울 게 없다 */
  private async clearOrderedCartItems(order: OrderEntity) {
    const items = await this.orderRepositoryService.findItemsByOrderId(
      order.id,
    );
    const cartItemIds = items
      .map((item) => item.cartItemId)
      .filter((id): id is number => id !== null);

    await this.cartRepositoryService.deleteByIds(order.userId, cartItemIds);
  }

  private async needsAttention(payment: PaymentEntity, note: string) {
    this.logger.error(
      `[결제 확인 필요] paymentId=${payment.id} orderId=${payment.orderId} ${note}`,
    );
    await this.paymentRepositoryService.saveEvent(
      payment.id,
      PaymentEventSource.NEEDS_ATTENTION,
      {
        orderId: payment.orderId,
        merchantTradeNo: payment.merchantTradeNo,
        amount: payment.amount,
      },
      note,
    );
  }
}

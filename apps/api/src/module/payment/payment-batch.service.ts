import { PaymentMethod } from '@app/repository/enum/order.enum';
import { PaymentStatus } from '@app/repository/enum/payment.enum';
import { OrderRepositoryService } from '@app/repository/service/order.repository.service';
import { PaymentRepositoryService } from '@app/repository/service/payment.repository.service';
import { Injectable, Logger } from '@nestjs/common';

import { EcpayPaymentService } from './ecpay-payment.service';
import { LinePayPaymentService } from './linepay-payment.service';
import { PaymentCompletionService } from './payment-completion.service';
import {
  ABANDON_AFTER_MINUTES,
  DEPOSIT_GRACE_MINUTES,
  ECPAY_QUERY_INTERVAL_MS,
  LINEPAY_CHECK_AFTER_MINUTES,
  PENDING_ORDER_TTL_HOURS,
  READY_EXPIRE_MINUTES,
} from './payment.constant';
import { minutesAgo, sleep } from './payment.util';
import { InvoiceIssueService } from '../invoice/invoice-issue.service';

/**
 * 결과 통지가 오지 않는 시도를 정리한다. 스케줄러가 부르고, 테스트는 직접 부른다.
 * 한 건이 실패해도 나머지는 계속 처리한다.
 */
@Injectable()
export class PaymentBatchService {
  private readonly logger = new Logger(PaymentBatchService.name);

  constructor(
    private readonly paymentRepositoryService: PaymentRepositoryService,
    private readonly orderRepositoryService: OrderRepositoryService,
    private readonly paymentCompletionService: PaymentCompletionService,
    private readonly ecpayPaymentService: EcpayPaymentService,
    private readonly linePayPaymentService: LinePayPaymentService,
    private readonly invoiceIssueService: InvoiceIssueService,
  ) {}

  async runAll(now: Date = new Date()) {
    await this.expireStaleReady(now);
    await this.expireDeposits(now);
    await this.reconcileLinePay(now);
    await this.reconcileEcpay(now);
    await this.cancelStaleOrders();
    await this.invoiceIssueService.retryPending();
  }

  /**
   * PG 로 넘기지 못하고 READY 로 남은 시도. 재고를 잡고 있는데 아무도 정리하지 않으면
   * 주문이 영영 재고를 붙든다.
   */
  async expireStaleReady(now: Date = new Date()) {
    const targets = await this.paymentRepositoryService.findStaleReady(
      minutesAgo(READY_EXPIRE_MINUTES, now),
    );

    await this.each(targets, (payment) =>
      this.paymentCompletionService.failAttempt(
        payment.id,
        PaymentStatus.EXPIRED,
        { code: 'READY_STALE' },
      ),
    );
  }

  /**
   * ATM·편의점 입금 기한 경과. ECPay 는 만료를 알려주지 않고, ReturnURL 을 놓친 입금이
   * 있을 수 있어 만료 전에 ECPay 에 한 번 묻는다 (EcpayPaymentService.expireDeposit)
   */
  async expireDeposits(now: Date = new Date()) {
    const targets =
      await this.paymentRepositoryService.findExpiredWaitingDeposit(
        minutesAgo(DEPOSIT_GRACE_MINUTES, now),
      );

    await this.each(targets, async (payment) => {
      await this.ecpayPaymentService.expireDeposit(payment, now);
      await sleep(ECPAY_QUERY_INTERVAL_MS);
    });
  }

  /** LINE Pay 는 서버 통지가 없다. confirmUrl 로 돌아오지 않은 시도를 상태 조회로 회수한다 */
  async reconcileLinePay(now: Date = new Date()) {
    const targets = await this.paymentRepositoryService.findStaleRequested(
      PaymentMethod.LINE_PAY,
      minutesAgo(LINEPAY_CHECK_AFTER_MINUTES, now),
    );

    await this.each(targets, (payment) =>
      this.linePayPaymentService.reconcile(payment, now),
    );
  }

  /** ECPay 결제창에서 이탈했거나 ReturnURL 을 놓친 시도 */
  async reconcileEcpay(now: Date = new Date()) {
    const targets = await this.paymentRepositoryService.findStaleRequested(
      PaymentMethod.ECPAY,
      minutesAgo(ABANDON_AFTER_MINUTES, now),
    );

    await this.each(targets, async (payment) => {
      await this.ecpayPaymentService.reconcile(payment, now);
      await sleep(ECPAY_QUERY_INTERVAL_MS);
    });
  }

  async cancelStaleOrders() {
    const orderIds = await this.orderRepositoryService.findStalePendingIds(
      PENDING_ORDER_TTL_HOURS,
    );

    await this.each(orderIds, (orderId) =>
      this.paymentCompletionService.cancelStaleOrder(orderId),
    );
  }

  private async each<T>(targets: T[], fn: (target: T) => Promise<unknown>) {
    for (const target of targets) {
      try {
        await fn(target);
      } catch (error) {
        this.logger.error(
          `payment batch item failed: ${describe(target)} ${error}`,
        );
      }
    }
  }
}

function describe(target: unknown): string {
  if (typeof target === 'object' && target !== null && 'id' in target) {
    return `paymentId=${(target as { id: number }).id}`;
  }

  return `orderId=${String(target)}`;
}

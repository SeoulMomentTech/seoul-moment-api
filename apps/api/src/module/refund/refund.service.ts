import { CacheService } from '@app/cache/cache.service';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import {
  LinePayRefundLookupDto,
  LinePayRefundResultDto,
  LinePayResultDto,
} from '@app/external/linepay/linepay.dto';
import { ExternalLinePayService } from '@app/external/linepay/linepay.service';
import { OrderEntity } from '@app/repository/entity/order.entity';
import { PaymentEntity } from '@app/repository/entity/payment.entity';
import { RefundEntity } from '@app/repository/entity/refund.entity';
import {
  OrderEventType,
  OrderStatus,
  PaymentMethod,
  PurchaseStatus,
} from '@app/repository/enum/order.enum';
import { PaymentEventSource } from '@app/repository/enum/payment.enum';
import { RefundStatus } from '@app/repository/enum/refund.enum';
import { canAutoRefund } from '@app/repository/helper/order-status.helper';
import {
  getOpenRefund,
  getRefundedAmount,
  isWaitingForPg,
} from '@app/repository/helper/refund.helper';
import { OrderRepositoryService } from '@app/repository/service/order.repository.service';
import { PaymentRepositoryService } from '@app/repository/service/payment.repository.service';
import { RefundRepositoryService } from '@app/repository/service/refund.repository.service';
import { Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { randomUUID } from 'crypto';
import { Transactional } from 'typeorm-transactional';

import { EcpayCardRefundService } from './ecpay-card-refund.service';
import { RefundNoticeService } from './refund-notice.service';
import { InvoiceAdjustService } from '../invoice/invoice-adjust.service';
import { StockReservationService } from '../payment/stock-reservation.service';

/** PG 호출(LINE Pay 조회 + 환불 각 20초 · ECPay 조회 10초 + 동작 두 번 각 20초) + 발표 정정(두 번, 각 15초)보다 넉넉히 */
const REFUND_LOCK_SECONDS = 120;
const REFUNDABLE_ORDER_STATUSES = [OrderStatus.PAID, OrderStatus.FAILED];
/**
 * LINE Pay 가 "환불하지 않았다"고 확정해 준 코드만 실패로 본다
 * (1150 거래 없음 · 1155 잘못된 거래번호 · 1163 환불 기간 만료 · 1164 환불 가능 금액 초과).
 * 그 밖의 코드(내부 오류·처리 중·중복 요청 등)는 돈이 나갔는지 모르는 것이라 실패로 닫지 않는다 —
 * 실패로 닫으면 수동 환불이 열려 두 번 돌려줄 수 있다.
 */
const LINE_PAY_REJECTED = ['1150', '1155', '1163', '1164'];

const AUTO_REFUND_REASON = '자동 환불 — 결제 후 24시간 안 · 발주 전 고객 취소';

export interface RefundRequestOptions {
  reason?: string;
  /** 생략하면 남은 금액 전부. 결제 금액보다 작으면 부분 환불 */
  amount?: number;
}

/**
 * 환불 (명세 v6 §8 · 환불 규정).
 *
 * - 고객이 결제 후 24시간 안에, 한국 발주 전에 취소하면 접수와 함께 자동으로 환불한다
 *   (requestAuto). 그 밖의 취소·품절·판매 중단은 관리자가 확인하고 실행한다 (request).
 * - 전액과 부분(금액 지정)을 모두 한다. 환불 합계가 결제 금액에 닿을 때에만 주문을 취소로
 *   바꾸고 재고를 돌려준다.
 * - LINE Pay 는 환불 API 를 부른다. 결과를 모르는 재시도는 조회부터 해서 같은 금액을 두 번
 *   돌려주지 않는다.
 * - ECPay 카드 결제는 請退款 API 를 부른다 (EcpayCardRefundService). 상점 검사 코드가
 *   설정돼 있고 결제 때 승인번호(gwsr)를 받아 둔 결제만이다.
 * - 그 밖의 ECPay 결제(ATM·편의점, 승인번호가 없는 예전 카드 결제)는 환불 API 가 없어서
 *   관리자가 ECPay 後台·계좌 송금으로 처리한 뒤 완료를 입력한다.
 * - 환불이 확인된 때에만 주문·재고를 고치고 발표 정정과 고객 알림을 시작한다. 발표 정정은
 *   환불과 따로 실패하고 따로 다시 시도한다.
 */
@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    private readonly refundRepositoryService: RefundRepositoryService,
    private readonly orderRepositoryService: OrderRepositoryService,
    private readonly paymentRepositoryService: PaymentRepositoryService,
    private readonly linePayService: ExternalLinePayService,
    private readonly ecpayCardRefundService: EcpayCardRefundService,
    private readonly stockReservationService: StockReservationService,
    private readonly invoiceAdjustService: InvoiceAdjustService,
    private readonly refundNoticeService: RefundNoticeService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * 환불 시작. 끝나지 않은 환불(실패·결과 미확인·완료 입력 대기)이 있으면 새로 만들지 않고
   * 그 환불을 다시 시도한다. adminId 가 null 이면 시스템이 시작한 자동 환불이다.
   */
  async request(
    adminId: number | null,
    orderId: number,
    options: RefundRequestOptions = {},
  ): Promise<RefundEntity> {
    return this.withLock(orderId, async () => {
      const order = await this.findOrder(orderId);
      const refunds =
        await this.refundRepositoryService.findAllByOrderId(orderId);
      const open = getOpenRefund(refunds);
      const refund = open
        ? await this.reuseOpen(adminId, open, refunds, options.amount)
        : await this.create(adminId, order, refunds, options);

      if (refund.isManual) {
        return refund;
      }

      return refund.method === PaymentMethod.LINE_PAY
        ? this.refundLinePay(adminId, refund)
        : this.refundEcpayCard(adminId, refund);
    });
  }

  /**
   * 고객 취소 접수 직후의 자동 환불 (환불 규정 1). 대상이 아니면 아무것도 하지 않는다.
   * 던지지 않는다 — 접수는 이미 끝났고, 자동 환불이 안 되면 관리자가 이어서 처리한다.
   */
  async requestAuto(orderId: number): Promise<void> {
    try {
      const order = await this.orderRepositoryService.findById(orderId);

      if (!order || !canAutoRefund(order, new Date())) {
        return;
      }

      // 관리자가 이미 시작한 환불을 고객의 취소로 대신 보내지 않는다
      if (
        getOpenRefund(
          await this.refundRepositoryService.findAllByOrderId(orderId),
        )
      ) {
        this.logger.warn(
          `[자동 환불 건너뜀 — 끝나지 않은 환불이 있음] orderId=${orderId}`,
        );

        return;
      }

      const reason = [AUTO_REFUND_REASON, order.cancellationReason]
        .filter(Boolean)
        .join(' / ')
        .slice(0, 500);

      await this.request(null, orderId, { reason });
    } catch (error) {
      this.logger.error(
        `[자동 환불 실패 — 관리자 처리 필요] orderId=${orderId} ${error}`,
      );
    }
  }

  /**
   * 관리자가 PG 밖에서 환불을 끝낸 뒤 완료를 기록한다. 수동 환불이거나, PG 가 환불하지
   * 않았다고 확정했거나(FAILED) 한 번도 보내지 않은 경우에만 된다.
   */
  async completeManually(
    adminId: number,
    orderId: number,
    reference: string,
  ): Promise<RefundEntity> {
    // 무엇으로 돌려줬는지 남지 않는 완료는 받지 않는다
    if (!reference.trim()) {
      throw new ServiceError(
        'reference is required',
        ServiceErrorCode.BAD_REQUEST,
      );
    }

    return this.withLock(orderId, async () => {
      await this.findOrder(orderId);

      const refund = getOpenRefund(
        await this.refundRepositoryService.findAllByOrderId(orderId),
      );

      if (!refund) {
        throw new ServiceError(
          `Order ${orderId} has no open refund to complete`,
          ServiceErrorCode.CONFLICT,
        );
      }

      this.assertNoPgResultPending(refund);

      // PG API 가 아니라 사람이 돌려준 환불로 남긴다
      await this.refundRepositoryService.updateUnlessCompleted(refund.id, {
        isManual: true,
      });

      return this.completeAndAdjust(
        adminId,
        refund,
        reference.trim(),
        'manual',
      );
    });
  }

  /**
   * 끝나지 않은 환불을 없던 일로 한다 (고객이 취소를 거뒀거나 잘못 시작한 환불).
   * 돈이 나갔을 수 있는 환불(결과 미확인)은 지우지 않는다 — 재시도로 결과부터 확인한다.
   */
  async cancelOpen(adminId: number, orderId: number): Promise<void> {
    return this.withLock(orderId, async () => {
      await this.findOrder(orderId);

      const open = getOpenRefund(
        await this.refundRepositoryService.findAllByOrderId(orderId),
      );

      if (!open || open.status === RefundStatus.PROCESSING) {
        throw new ServiceError(
          open
            ? `Refund of order ${orderId} has an unknown PG result. Retry it first`
            : `Order ${orderId} has no open refund to cancel`,
          ServiceErrorCode.CONFLICT,
        );
      }

      if (await this.refundRepositoryService.deleteOpen(open.id)) {
        await this.log(
          open,
          OrderEventType.REFUND_CANCELED,
          adminId,
          `NT$${open.amount} ${open.status} ${open.reason ?? ''}`,
        );
      }
    });
  }

  private async create(
    adminId: number | null,
    order: OrderEntity,
    refunds: RefundEntity[],
    options: RefundRequestOptions,
  ): Promise<RefundEntity> {
    const payment = await this.findPaidPayment(order);
    const refundable = payment.amount - getRefundedAmount(refunds);
    const amount = options.amount ?? refundable;

    this.assertRefundable(order.id, amount, refundable);

    const reason = options.reason?.trim() || null;
    const refund = await this.insert(
      plainToInstance(RefundEntity, {
        orderId: order.id,
        paymentId: payment.id,
        method: payment.method,
        amount,
        status: RefundStatus.REQUESTED,
        isManual:
          payment.method !== PaymentMethod.LINE_PAY &&
          !this.ecpayCardRefundService.supports(payment),
        reason,
        adminId,
        attemptCount: 0,
        requestedAt: new Date(),
      }),
    );

    await this.log(
      refund,
      OrderEventType.REFUND_REQUESTED,
      adminId,
      `${refund.method} NT$${amount}${amount < payment.amount ? ' (partial)' : ''}${refund.isManual ? ' (manual)' : ''} ${reason ?? ''}`,
    );

    return refund;
  }

  /**
   * 결과를 모르는 PG 환불을 수동 완료로 덮으면 이중 환불이 될 수 있다.
   * 수동 환불이거나, 거절됐거나(FAILED) 한 번도 보내지 않은 환불만 받는다.
   */
  private assertNoPgResultPending(refund: RefundEntity) {
    const neverLeft =
      refund.status === RefundStatus.FAILED || refund.attemptCount === 0;

    if (!refund.isManual && !neverLeft) {
      throw new ServiceError(
        `Refund of order ${refund.orderId} is still being processed by the PG. Retry it instead`,
        ServiceErrorCode.CONFLICT,
      );
    }
  }

  private async findPaidPayment(order: OrderEntity): Promise<PaymentEntity> {
    if (!REFUNDABLE_ORDER_STATUSES.includes(order.status)) {
      throw new ServiceError(
        `Order ${order.id} has no payment to refund (status=${order.status})`,
        ServiceErrorCode.CONFLICT,
      );
    }

    const paid = await this.paymentRepositoryService.findPaidByOrderId(
      order.id,
    );

    // 중복 결제는 어느 결제를 돌려줄지 사람이 정해야 한다
    if (paid.length !== 1) {
      throw new ServiceError(
        `Order ${order.id} has ${paid.length} paid payments. Refund it manually`,
        ServiceErrorCode.CONFLICT,
      );
    }

    return paid[0];
  }

  /**
   * 끝나지 않은 환불을 그대로 다시 시도한다. 금액을 다르게 보냈으면, 돈이 나갔을 수 없는
   * 환불(완료 입력 대기·PG 가 거절)만 금액을 고친다. 결과를 모르는 환불은 고치지 않는다.
   */
  private async reuseOpen(
    adminId: number | null,
    open: RefundEntity,
    refunds: RefundEntity[],
    amount?: number,
  ): Promise<RefundEntity> {
    if (amount === undefined || amount === open.amount) {
      return open;
    }

    if (open.status === RefundStatus.PROCESSING) {
      throw new ServiceError(
        `Refund of order ${open.orderId} (NT$${open.amount}) has an unknown PG result. Retry it without amount first`,
        ServiceErrorCode.CONFLICT,
      );
    }

    const payment = await this.paymentRepositoryService.findById(
      open.paymentId,
    );

    this.assertRefundable(
      open.orderId,
      amount,
      payment.amount - getRefundedAmount(refunds),
    );
    await this.refundRepositoryService.updateUnlessCompleted(open.id, {
      amount,
    });
    await this.log(
      open,
      OrderEventType.REFUND_REQUESTED,
      adminId,
      `amount NT$${open.amount} → NT$${amount}`,
    );

    return this.refundRepositoryService.findById(open.id);
  }

  private assertRefundable(
    orderId: number,
    amount: number,
    refundable: number,
  ) {
    if (refundable <= 0) {
      throw new ServiceError(
        `Order ${orderId} is already fully refunded`,
        ServiceErrorCode.CONFLICT,
      );
    }

    if (amount > refundable) {
      throw new ServiceError(
        `Refund amount NT$${amount} exceeds the refundable NT$${refundable}`,
        ServiceErrorCode.BAD_REQUEST,
      );
    }
  }

  /** 락이 풀린 틈에 같은 주문의 환불이 먼저 만들어졌으면(부분 UNIQUE) 409 로 돌린다 */
  private async insert(entity: RefundEntity): Promise<RefundEntity> {
    try {
      return await this.refundRepositoryService.save(entity);
    } catch (error) {
      this.logger.error(`refund insert failed: ${error}`);

      throw new ServiceError(
        `Refund of order ${entity.orderId} was started by another request`,
        ServiceErrorCode.CONFLICT,
      );
    }
  }

  private async refundLinePay(
    adminId: number | null,
    refund: RefundEntity,
  ): Promise<RefundEntity> {
    const payment = await this.paymentRepositoryService.findById(
      refund.paymentId,
    );
    const transactionId = payment?.pgTransactionId;

    if (!transactionId) {
      return this.markFailed(refund, 'NO_TRANSACTION_ID', 'no transactionId');
    }

    // 이전 시도의 결과를 모른다 — 이미 나간 환불이 있는지부터 본다
    const stopped =
      refund.attemptCount > 0
        ? await this.settleFromLookup(adminId, refund, transactionId)
        : await this.rememberRefundedBefore(refund, transactionId);

    if (stopped) {
      return stopped;
    }

    if (isWaitingForPg(refund, new Date())) {
      return this.markUnknown(
        refund,
        'not found by lookup yet. Retry after 5 minutes',
      );
    }

    return this.sendLinePayRefund(adminId, refund, transactionId);
  }

  /** ECPay 카드 환불. PG 와 주고받는 일은 EcpayCardRefundService 가 하고 여기서는 결과만 반영한다 */
  private async refundEcpayCard(
    adminId: number | null,
    refund: RefundEntity,
  ): Promise<RefundEntity> {
    const outcome = await this.ecpayCardRefundService.refund(refund);

    switch (outcome.kind) {
      case 'completed':
        return this.completeAndAdjust(adminId, refund, outcome.pgRefundId);
      case 'failed':
        return this.markFailed(refund, outcome.code, outcome.message);
      case 'unknown':
        return this.markUnknown(refund, outcome.message);
      default:
        return this.hold(refund, outcome.code, outcome.message);
    }
  }

  /**
   * 앞선 환불이 있는 주문이면, 처음 보내기 전에 LINE Pay 에 이미 있는 환불 합계를 적어 둔다.
   * 결과를 모를 때 이 합계에서 늘어난 만큼만 이 환불로 본다 — 앞선 부분 환불이나 가맹점
   * 화면에서 따로 한 환불을 이 환불로 착각하지 않는다. 조회가 안 되면 보내지 않고 멈춘다.
   * shortcut: 주문의 첫 환불은 조회하지 않고 0 으로 본다 — 그 전에 가맹점 화면에서 따로
   * 환불한 주문이면, 결과를 모를 때 그 금액을 이 환불로 볼 수 있다. LINE Pay 조회를 운영에서
   * 검증한 뒤 모든 환불이 기준선을 잡도록 넓힌다.
   */
  private async rememberRefundedBefore(
    refund: RefundEntity,
    transactionId: string,
  ): Promise<RefundEntity | null> {
    const refunds = await this.refundRepositoryService.findAllByOrderId(
      refund.orderId,
    );

    if (refunds.length < 2) {
      return null;
    }

    const found = await this.linePayService
      .findRefund(transactionId)
      .catch(() => null);

    if (!found?.isSuccess()) {
      return this.hold(
        refund,
        'LOOKUP_FAILED',
        `not sent: ${found?.returnCode ?? 'network'} ${found?.returnMessage ?? ''}`,
      );
    }

    // 방금 끝난 환불이 조회에 아직 안 보일 수 있다 — 이 시스템이 보낸 합계보다 작게 잡지 않는다
    const sentBefore = getRefundedAmount(
      refunds.filter(
        (other) => !other.isManual && other.paymentId === refund.paymentId,
      ),
    );

    refund.pgRefundedBefore = Math.max(found.refundedAmount, sentBefore);
    await this.refundRepositoryService.updateUnlessCompleted(refund.id, {
      pgRefundedBefore: refund.pgRefundedBefore,
    });

    return null;
  }

  /** 요청 횟수를 먼저 저장하고 부른다 — 응답을 못 받아도 다음 시도가 조회부터 한다 */
  private async sendLinePayRefund(
    adminId: number | null,
    refund: RefundEntity,
    transactionId: string,
  ): Promise<RefundEntity> {
    await this.refundRepositoryService.updateUnlessCompleted(refund.id, {
      attemptCount: refund.attemptCount + 1,
      status: RefundStatus.PROCESSING,
      lastAttemptAt: new Date(),
    });

    let result: LinePayRefundResultDto;

    try {
      result = await this.linePayService.refund(transactionId, refund.amount);
    } catch (error) {
      return this.markUnknown(refund, String(error));
    }

    await this.paymentRepositoryService.saveEvent(
      refund.paymentId,
      PaymentEventSource.LINEPAY_REFUND,
      { ...result },
    );

    if (result.isSuccess()) {
      return this.completeAndAdjust(
        adminId,
        refund,
        result.refundTransactionId,
      );
    }

    // "이미 환불됨"은 이 시스템 밖에서 환불했다는 뜻이다 — 얼마가 나갔는지 조회로 확인한다
    if (result.isAlreadyRefunded()) {
      return (
        (await this.settleFromLookup(adminId, refund, transactionId, true)) ??
        this.markUnknown(refund, '1165 but no refund found by lookup')
      );
    }

    return this.markRejectedOrUnknown(refund, result);
  }

  /**
   * LINE Pay 에 이미 환불이 있으면 그 결과로 닫는다. 조회가 안 되면 다시 환불하지 않고
   * 멈춘다 — 모르는 채로 한 번 더 부르면 두 번 돌려줄 수 있다. 환불이 없으면 null.
   * LINE Pay 는 거래의 환불 합계를 주므로, 이 환불을 보내기 전에 있던 합계를 빼고 본다.
   */
  private async settleFromLookup(
    adminId: number | null,
    refund: RefundEntity,
    transactionId: string,
    isAlreadyRefunded = false,
  ): Promise<RefundEntity | null> {
    let found: LinePayRefundLookupDto;

    try {
      found = await this.linePayService.findRefund(transactionId);
    } catch (error) {
      return this.markUnknown(refund, `lookup: ${error}`);
    }

    if (!found.isSuccess()) {
      return this.markRejectedOrUnknown(refund, found);
    }

    const unmatched = found.refundedAmount - (refund.pgRefundedBefore ?? 0);

    if (unmatched >= refund.amount) {
      return this.completeAndAdjust(
        adminId,
        refund,
        found.findTransactionId(
          refund.amount,
          await this.getPgRefundIds(refund),
        ),
      );
    }

    if (unmatched > 0) {
      return this.markFailed(
        refund,
        'PARTIALLY_REFUNDED',
        `NT$${unmatched} already refunded outside this system`,
      );
    }

    return isAlreadyRefunded ? this.closeIfFullyRefunded(refund, found) : null;
  }

  /**
   * LINE Pay 가 "이미 환불됨"으로 거절했고, 결제 금액 전부가 이 환불을 보내기 전에 이미
   * 돌아가 있었다 — 이 환불은 나가지 않았다. 실패로 닫아 관리자가 완료 입력이나 요청 취소로
   * 정리하게 한다 (결과 미확인으로 두면 다시 보내도 같은 거절만 되풀이된다).
   */
  private async closeIfFullyRefunded(
    refund: RefundEntity,
    found: LinePayRefundLookupDto,
  ): Promise<RefundEntity | null> {
    const payment = await this.paymentRepositoryService.findById(
      refund.paymentId,
    );

    return found.refundedAmount >= payment.amount
      ? this.markFailed(
          refund,
          'ALREADY_REFUNDED',
          `NT$${found.refundedAmount} was refunded before this refund`,
        )
      : null;
  }

  /** 이 주문의 다른 환불에 이미 적어 둔 LINE Pay 환불 거래번호 */
  private async getPgRefundIds(refund: RefundEntity): Promise<string[]> {
    const refunds = await this.refundRepositoryService.findAllByOrderId(
      refund.orderId,
    );

    return refunds
      .filter((other) => other.id !== refund.id && !!other.pgRefundId)
      .map((other) => other.pgRefundId);
  }

  /**
   * 환불 확인 뒤 한 번만 도는 마무리 (한 트랜잭션). 환불 합계가 결제 금액에 닿았을 때에만
   * 주문을 취소로 바꾸고, 아직 한국에 발주하지 않은 주문이면 잡아 둔 재고를 돌려준다.
   * shortcut: 부분 환불과 이미 발주한 주문은 재고를 돌려주지 않는다 — 부분 환불은 금액만
   * 받고 어느 상품인지 모른다. 상품 단위 환불·회수 후 재입고(명세 §7.4)를 만들 때 잇는다.
   */
  @Transactional()
  private async complete(
    adminId: number | null,
    refund: RefundEntity,
    pgRefundId: string | null,
    note = '',
  ): Promise<RefundEntity> {
    const order = await this.orderRepositoryService.findByIdForUpdate(
      refund.orderId,
    );
    const now = new Date();
    const marked = await this.refundRepositoryService.markCompleted(
      refund.id,
      pgRefundId,
      now,
    );

    if (!marked) {
      return this.refundRepositoryService.findById(refund.id);
    }

    const [payment, refunds] = await Promise.all([
      this.paymentRepositoryService.findById(refund.paymentId),
      this.refundRepositoryService.findAllByOrderId(order.id),
    ]);
    const isFull = getRefundedAmount(refunds) >= payment.amount;

    if (isFull) {
      await this.cancelOrder(order);
    }

    await this.orderRepositoryService.markInvoiceAdjustPending(order.id);
    await this.log(
      refund,
      OrderEventType.REFUND_COMPLETED,
      adminId,
      `NT$${refund.amount}${isFull ? '' : ' (partial)'} ${note} ${pgRefundId ?? ''}`,
    );

    return this.refundRepositoryService.findById(refund.id);
  }

  private async cancelOrder(order: OrderEntity) {
    if (order.purchaseStatus === PurchaseStatus.NOT_ORDERED) {
      await this.stockReservationService.release(order);
    }

    await this.orderRepositoryService.updateOrder(order.id, {
      status: OrderStatus.CANCELED,
    });
  }

  /**
   * 환불을 확정(커밋)한 뒤 발표 정정을 이어서 한 번 시도하고 고객에게 알린다. 정정·알림이
   * 실패해도 환불은 그대로고, 남은 정정은 배치와 관리자 재시도가 맡는다.
   */
  private async completeAndAdjust(
    adminId: number | null,
    refund: RefundEntity,
    pgRefundId: string | null,
    note = '',
  ): Promise<RefundEntity> {
    const completed = await this.complete(adminId, refund, pgRefundId, note);

    await this.invoiceAdjustService
      .adjustForOrder(refund.orderId)
      .catch((error) =>
        this.logger.error(
          `invoice adjust failed: orderId=${refund.orderId} ${error}`,
        ),
      );
    await this.refundNoticeService.notifyCompleted(completed);

    return completed;
  }

  private markRejectedOrUnknown(
    refund: RefundEntity,
    result: LinePayResultDto,
  ): Promise<RefundEntity> {
    return LINE_PAY_REJECTED.includes(result.returnCode)
      ? this.markFailed(refund, result.returnCode, result.returnMessage)
      : this.markUnknown(
          refund,
          `${result.returnCode} ${result.returnMessage}`,
        );
  }

  /** PG 가 환불하지 않았다고 확정했다. 사유를 보고 수동으로 돌려줄 수 있다 */
  private async markFailed(
    refund: RefundEntity,
    code: string,
    message: string,
  ): Promise<RefundEntity> {
    this.logger.error(
      `[환불 실패 — 확인 필요] orderId=${refund.orderId} ${code} ${message}`,
    );
    await this.log(
      refund,
      OrderEventType.REFUND_FAILED,
      null,
      `${code} ${message}`,
    );

    return this.updateOpen(refund, {
      status: RefundStatus.FAILED,
      failureCode: code.slice(0, 50),
      failureMessage: message.slice(0, 255),
    });
  }

  /** 결과를 모른다 (타임아웃·조회 실패·불명확한 응답). 다음 시도가 조회부터 한다 */
  private async markUnknown(
    refund: RefundEntity,
    message: string,
  ): Promise<RefundEntity> {
    this.logger.error(
      `[환불 결과 미확인 — 다시 시도 필요] orderId=${refund.orderId} ${message}`,
    );

    return this.updateOpen(refund, {
      status: RefundStatus.PROCESSING,
      failureCode: 'UNKNOWN_RESULT',
      failureMessage: message.slice(0, 255),
    });
  }

  /** PG 에 보내지 않고 멈췄다 (조회 실패·매입 시간대). 상태는 그대로 두고 사유만 남긴다 */
  private async hold(
    refund: RefundEntity,
    code: string,
    message: string,
  ): Promise<RefundEntity> {
    this.logger.error(
      `[환불 보류 — 보내지 않음] orderId=${refund.orderId} ${code} ${message}`,
    );

    return this.updateOpen(refund, {
      status: refund.status,
      failureCode: code,
      failureMessage: message.slice(0, 255),
    });
  }

  /** 완료된 환불은 덮지 않는다 (늦게 끝난 요청이 COMPLETED 를 되돌리지 못하게) */
  private async updateOpen(
    refund: RefundEntity,
    fields: Pick<RefundEntity, 'status' | 'failureCode' | 'failureMessage'>,
  ): Promise<RefundEntity> {
    await this.refundRepositoryService.updateUnlessCompleted(refund.id, fields);

    return this.refundRepositoryService.findById(refund.id);
  }

  private async findOrder(orderId: number): Promise<OrderEntity> {
    const order = await this.orderRepositoryService.findById(orderId);

    if (!order) {
      throw new ServiceError(
        `No exist order ID: ${orderId}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return order;
  }

  /** 같은 주문의 환불을 한 번에 하나만 돌린다 (버튼 중복 클릭) */
  private async withLock<T>(
    orderId: number,
    work: () => Promise<T>,
  ): Promise<T> {
    const key = `refund_lock:${orderId}`;
    const owner = randomUUID();
    const locked = await this.cacheService
      .setIfAbsent(key, owner, REFUND_LOCK_SECONDS)
      .catch(() => false);

    if (!locked) {
      throw new ServiceError(
        `Refund of order ${orderId} is already in progress`,
        ServiceErrorCode.CONFLICT,
      );
    }

    try {
      return await work();
    } finally {
      await this.cacheService.deleteIfValue(key, owner).catch(() => undefined);
    }
  }

  private async log(
    refund: RefundEntity,
    type: OrderEventType,
    adminId: number | null,
    message: string,
  ) {
    await this.orderRepositoryService.saveEvents([
      {
        orderId: refund.orderId,
        type,
        adminId,
        userId: null,
        message: message.replace(/\s+/g, ' ').trim(),
      },
    ]);
  }
}

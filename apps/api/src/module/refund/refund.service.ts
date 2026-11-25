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
import { RefundEntity } from '@app/repository/entity/refund.entity';
import {
  OrderEventType,
  OrderStatus,
  PaymentMethod,
  PurchaseStatus,
} from '@app/repository/enum/order.enum';
import { PaymentEventSource } from '@app/repository/enum/payment.enum';
import { RefundStatus } from '@app/repository/enum/refund.enum';
import { OrderRepositoryService } from '@app/repository/service/order.repository.service';
import { PaymentRepositoryService } from '@app/repository/service/payment.repository.service';
import { RefundRepositoryService } from '@app/repository/service/refund.repository.service';
import { Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { randomUUID } from 'crypto';
import { Transactional } from 'typeorm-transactional';

import { InvoiceAdjustService } from '../invoice/invoice-adjust.service';
import { StockReservationService } from '../payment/stock-reservation.service';

/** LINE Pay 호출 두 번(조회 + 환불, 각 20초) + 발표 정정(ECPay 두 번, 각 15초)보다 넉넉히 */
const REFUND_LOCK_SECONDS = 120;
const REFUNDABLE_ORDER_STATUSES = [OrderStatus.PAID, OrderStatus.FAILED];
/**
 * LINE Pay 가 "환불하지 않았다"고 확정해 준 코드만 실패로 본다
 * (1150 거래 없음 · 1155 잘못된 거래번호 · 1163 환불 기간 만료 · 1164 환불 가능 금액 초과).
 * 그 밖의 코드(내부 오류·처리 중·중복 요청 등)는 돈이 나갔는지 모르는 것이라 실패로 닫지 않는다 —
 * 실패로 닫으면 수동 환불이 열려 두 번 돌려줄 수 있다.
 */
const LINE_PAY_REJECTED = ['1150', '1155', '1163', '1164'];

/**
 * 전액 환불 (명세 v6 §8). 관리자가 실행한다 — 고객의 취소 신청만으로 돈이 나가지 않는다.
 *
 * - LINE Pay 는 환불 API 를 부른다. 결과를 모르는 재시도는 조회부터 해서 같은 금액을 두 번
 *   돌려주지 않는다.
 * - ECPay(카드·ATM·편의점)는 API 를 부르지 않는다. 카드 환불(DoAction)은 테스트 환경에서
 *   검증할 수 없고 ATM·편의점은 환불 API 가 없어서, 관리자가 ECPay 후台·계좌 송금으로 처리한
 *   뒤 완료를 입력한다.
 * - 환불이 확인된 때에만 주문을 취소로 바꾸고 발표 정정을 시작한다. 발표 정정은 환불과 따로
 *   실패하고 따로 다시 시도한다.
 */
@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    private readonly refundRepositoryService: RefundRepositoryService,
    private readonly orderRepositoryService: OrderRepositoryService,
    private readonly paymentRepositoryService: PaymentRepositoryService,
    private readonly linePayService: ExternalLinePayService,
    private readonly stockReservationService: StockReservationService,
    private readonly invoiceAdjustService: InvoiceAdjustService,
    private readonly cacheService: CacheService,
  ) {}

  /** 환불 시작. 실패했거나 결과를 모르는 환불이 있으면 그 환불을 다시 시도한다 */
  async request(
    adminId: number,
    orderId: number,
    reason?: string,
  ): Promise<RefundEntity> {
    return this.withLock(orderId, async () => {
      const order = await this.findOrder(orderId);
      const existing =
        await this.refundRepositoryService.findByOrderId(orderId);

      this.assertNotCompleted(existing);

      const refund =
        existing ?? (await this.create(adminId, order, reason?.trim() || null));

      return refund.isManual ? refund : this.refundLinePay(adminId, refund);
    });
  }

  /**
   * 관리자가 PG 밖에서 환불을 끝낸 뒤 완료를 기록한다. 수동 환불(ECPay)이거나,
   * LINE Pay 가 환불하지 않았다고 확정한(FAILED) 경우에만 된다.
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

      const refund = await this.refundRepositoryService.findByOrderId(orderId);

      if (!refund) {
        throw new ServiceError(
          `Order ${orderId} has no refund to complete`,
          ServiceErrorCode.CONFLICT,
        );
      }

      this.assertNotCompleted(refund);

      // 결과를 모르는 LINE Pay 환불을 수동 완료로 덮으면 이중 환불이 될 수 있다
      if (!refund.isManual && refund.status !== RefundStatus.FAILED) {
        throw new ServiceError(
          `Refund of order ${orderId} is still being processed by the PG. Retry it instead`,
          ServiceErrorCode.CONFLICT,
        );
      }

      return this.completeAndAdjust(
        adminId,
        refund,
        reference.trim(),
        'manual',
      );
    });
  }

  private async create(
    adminId: number,
    order: OrderEntity,
    reason: string | null,
  ): Promise<RefundEntity> {
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

    const [payment] = paid;
    const refund = await this.insert(
      plainToInstance(RefundEntity, {
        orderId: order.id,
        paymentId: payment.id,
        method: payment.method,
        amount: payment.amount,
        status: RefundStatus.REQUESTED,
        isManual: payment.method !== PaymentMethod.LINE_PAY,
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
      `${refund.method} NT$${refund.amount}${refund.isManual ? ' (manual)' : ''} ${reason ?? ''}`,
    );

    return refund;
  }

  /** 락이 풀린 틈에 같은 주문의 환불이 먼저 만들어졌으면(order_id UNIQUE) 409 로 돌린다 */
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
    adminId: number,
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
    if (refund.attemptCount > 0) {
      const settled = await this.settleFromLookup(
        adminId,
        refund,
        transactionId,
      );

      if (settled) {
        return settled;
      }
    }

    return this.sendLinePayRefund(adminId, refund, transactionId);
  }

  /** 요청 횟수를 먼저 저장하고 부른다 — 응답을 못 받아도 다음 시도가 조회부터 한다 */
  private async sendLinePayRefund(
    adminId: number,
    refund: RefundEntity,
    transactionId: string,
  ): Promise<RefundEntity> {
    await this.refundRepositoryService.updateUnlessCompleted(refund.id, {
      attemptCount: refund.attemptCount + 1,
      status: RefundStatus.PROCESSING,
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
        (await this.settleFromLookup(adminId, refund, transactionId)) ??
        this.markUnknown(refund, '1165 but no refund found by lookup')
      );
    }

    return this.markRejectedOrUnknown(refund, result);
  }

  /**
   * LINE Pay 에 이미 환불이 있으면 그 결과로 닫는다. 조회가 안 되면 다시 환불하지 않고
   * 멈춘다 — 모르는 채로 한 번 더 부르면 두 번 돌려줄 수 있다. 환불이 없으면 null.
   */
  private async settleFromLookup(
    adminId: number,
    refund: RefundEntity,
    transactionId: string,
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

    if (found.refundedAmount >= refund.amount) {
      return this.completeAndAdjust(adminId, refund, found.refundTransactionId);
    }

    if (found.refundedAmount > 0) {
      return this.markFailed(
        refund,
        'PARTIALLY_REFUNDED',
        `NT$${found.refundedAmount} already refunded outside this system`,
      );
    }

    return null;
  }

  /**
   * 환불 확인 뒤 한 번만 도는 마무리 (한 트랜잭션). 주문을 취소로 바꾸고, 아직 한국에
   * 발주하지 않은 주문이면 잡아 둔 재고를 돌려준다.
   * shortcut: 이미 발주한 주문은 재고를 돌려주지 않는다 — 회수·검수 후 재입고(명세 §7.4)를 만들 때 잇는다.
   */
  @Transactional()
  private async complete(
    adminId: number,
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
      return this.refundRepositoryService.findByOrderId(refund.orderId);
    }

    if (order.purchaseStatus === PurchaseStatus.NOT_ORDERED) {
      await this.stockReservationService.release(order);
    }

    await this.orderRepositoryService.updateOrder(order.id, {
      status: OrderStatus.CANCELED,
    });
    await this.orderRepositoryService.markInvoiceAdjustPending(order.id);
    await this.log(
      refund,
      OrderEventType.REFUND_COMPLETED,
      adminId,
      `NT$${refund.amount} ${note} ${pgRefundId ?? ''}`,
    );

    return this.refundRepositoryService.findByOrderId(refund.orderId);
  }

  /**
   * 환불을 확정(커밋)한 뒤 발표 정정을 이어서 한 번 시도한다. 정정이 실패해도 환불은
   * 그대로고, 남은 정정은 배치와 관리자 재시도가 맡는다.
   */
  private async completeAndAdjust(
    adminId: number,
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

  /** 완료된 환불은 덮지 않는다 (늦게 끝난 요청이 COMPLETED 를 되돌리지 못하게) */
  private async updateOpen(
    refund: RefundEntity,
    fields: Pick<RefundEntity, 'status' | 'failureCode' | 'failureMessage'>,
  ): Promise<RefundEntity> {
    await this.refundRepositoryService.updateUnlessCompleted(refund.id, fields);

    return this.refundRepositoryService.findByOrderId(refund.orderId);
  }

  private assertNotCompleted(refund: RefundEntity | null) {
    if (refund?.status === RefundStatus.COMPLETED) {
      throw new ServiceError(
        `Order ${refund.orderId} is already refunded`,
        ServiceErrorCode.CONFLICT,
      );
    }
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

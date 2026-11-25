import { CacheService } from '@app/cache/cache.service';
import {
  EcpayInvoiceAdjustResultDto,
  EcpayInvoiceResultDto,
  EcpayInvoiceRtnCode,
} from '@app/external/ecpay/ecpay-invoice.dto';
import { ExternalEcpayInvoiceService } from '@app/external/ecpay/ecpay-invoice.service';
import { parseTaipeiDateTime } from '@app/external/ecpay/ecpay.date';
import { OrderInvoiceEntity } from '@app/repository/entity/order-invoice.entity';
import {
  InvoiceAdjustStatus,
  InvoiceStatus,
} from '@app/repository/enum/invoice.enum';
import { OrderEventType, OrderStatus } from '@app/repository/enum/order.enum';
import { getRefundedAmount } from '@app/repository/helper/refund.helper';
import { OrderRepositoryService } from '@app/repository/service/order.repository.service';
import { RefundRepositoryService } from '@app/repository/service/refund.repository.service';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

import {
  buildAllowanceData,
  getVoidDeadline,
  toTaipeiDate,
} from './invoice.util';

/** 배치가 다시 시도하는 횟수. 넘기면 관리자가 직접 다시 시도한다 */
export const INVOICE_ADJUST_MAX_ATTEMPTS = 5;
/** ECPay 호출 두 번(조회 + 정정, 각 15초 타임아웃)보다 넉넉히 */
const ADJUST_LOCK_SECONDS = 120;
/** Invalid 의 Reason 은 20자 이하 */
const ADJUST_REASON = '訂單取消退款';
const PARTIAL_REASON = '訂單部分退款';

/** 발표 금액(주문 결제 금액)과 지금까지 돌려준 합계 */
interface RefundTotals {
  total: number;
  refunded: number;
  /** 아직 발행 전이라도 나중에 전액으로 발행될 주문인지 (결제 완료 + 부분 환불) */
  willBeIssued: boolean;
}
const OPEN_STATUSES = [InvoiceAdjustStatus.PENDING, InvoiceAdjustStatus.FAILED];

/**
 * 환불이 끝난 주문의 전자발표 정정 (명세 v6 §8.4).
 *
 * 환불(PG)과 따로 돈다 — 정정이 실패해도 환불을 다시 하지 않고 정정만 다시 시도한다.
 * 전액 환불이고 신고 기한 안이면 作廢, 그 밖(부분 환불·기한 경과)은 折讓 한다. 요청 전에
 * ECPay 에 현재 상태를 물어, 발표에 이미 折讓 된 금액과 환불 합계의 차이만큼만 정정한다 —
 * 같은 환불을 두 번 정정하지 않고, 부분 환불이 여러 번이어도 합계가 맞는다. 발행과 같은
 * 락을 써서 발행 중인 발표를 동시에 건드리지 않고, 저장은 정정 칸만 고친다.
 */
@Injectable()
export class InvoiceAdjustService {
  private readonly logger = new Logger(InvoiceAdjustService.name);

  constructor(
    private readonly orderRepositoryService: OrderRepositoryService,
    private readonly refundRepositoryService: RefundRepositoryService,
    private readonly ecpayInvoiceService: ExternalEcpayInvoiceService,
    private readonly cacheService: CacheService,
  ) {}

  /** 다른 작업(발행·정정)이 돌고 있어 건너뛰었으면 null — 정정 대기로 남아 배치가 집는다 */
  async adjustForOrder(
    orderId: number,
    now: Date = new Date(),
  ): Promise<OrderInvoiceEntity | null> {
    const key = `invoice_issue_lock:${orderId}`;
    const owner = randomUUID();
    const locked = await this.cacheService
      .setIfAbsent(key, owner, ADJUST_LOCK_SECONDS)
      .catch(() => false);

    if (!locked) {
      return null;
    }

    try {
      return await this.adjust(orderId, now);
    } finally {
      await this.cacheService.deleteIfValue(key, owner).catch(() => undefined);
    }
  }

  async retryPending(): Promise<void> {
    const invoices = await this.orderRepositoryService.findInvoicesToAdjust(
      INVOICE_ADJUST_MAX_ATTEMPTS,
    );

    for (const invoice of invoices) {
      await this.adjustForOrder(invoice.orderId).catch((error) =>
        this.logger.error(
          `invoice adjust retry failed: orderId=${invoice.orderId} ${error}`,
        ),
      );
    }
  }

  private async adjust(
    orderId: number,
    now: Date,
  ): Promise<OrderInvoiceEntity | null> {
    const invoice =
      await this.orderRepositoryService.findInvoiceByOrderId(orderId);

    if (!invoice || !OPEN_STATUSES.includes(invoice.adjustStatus)) {
      return invoice;
    }

    const totals = await this.getTotals(orderId);
    const { refunded } = totals;

    if (refunded <= 0) {
      return invoice;
    }

    invoice.adjustAttemptCount += 1;

    // 발행을 한 번도 요청하지 않았다. 앞으로도 발행되지 않을 주문이면 정정할 발표가 없다.
    // 부분 환불된 결제 완료 주문은 나중에 전액으로 발행된다 — 닫지 않고 발행 뒤에 다시 본다
    if (!invoice.relateNumber) {
      return totals.willBeIssued
        ? this.fail(invoice, 'NOT_ISSUED_YET', 'invoice is not issued yet')
        : this.finish(invoice, InvoiceAdjustStatus.NONE);
    }

    let state: EcpayInvoiceResultDto;

    try {
      state = await this.ecpayInvoiceService.getIssue(invoice.relateNumber);
    } catch (error) {
      return this.fail(invoice, 'NETWORK', String(error));
    }

    if (!state.isIssued()) {
      return this.closeNotIssued(invoice, state, !totals.willBeIssued);
    }

    await this.syncIssued(invoice, state);

    if (state.isVoided) {
      return this.finish(invoice, InvoiceAdjustStatus.VOIDED);
    }

    return this.request(invoice, totals, state, now);
  }

  private async getTotals(orderId: number): Promise<RefundTotals> {
    const [order, refunds] = await Promise.all([
      this.orderRepositoryService.findById(orderId),
      this.refundRepositoryService.findAllByOrderId(orderId),
    ]);

    const refunded = getRefundedAmount(refunds);

    return {
      total: order.totalAmount,
      refunded,
      willBeIssued:
        order.status === OrderStatus.PAID && refunded < order.totalAmount,
    };
  }

  /**
   * 折讓 으로 닫는다. 정정하는 동안 환불이 더 끝났으면(부분 환불이 이어진 경우) 닫지 않고
   * 다시 대기로 돌린다 — 그 환불의 정정 요청은 이 정정의 락에 막혀 건너뛰었다.
   */
  private async finishAllowanced(
    invoice: OrderInvoiceEntity,
    adjustedFor: number,
    allowanceNo?: string | null,
  ): Promise<OrderInvoiceEntity> {
    await this.finish(invoice, InvoiceAdjustStatus.ALLOWANCED, allowanceNo);

    const { refunded } = await this.getTotals(invoice.orderId);

    if (refunded === adjustedFor) {
      return invoice;
    }

    invoice.adjustStatus = InvoiceAdjustStatus.PENDING;
    invoice.adjustAttemptCount = 0;
    await this.saveAdjustFields(invoice);

    return invoice;
  }

  /**
   * ECPay 에 발표가 없다. 우리도 발행된 적이 없다고 알고 있고 전액을 돌려줬을 때만 "정정할
   * 것 없음"이다. 발행됐다고 기록돼 있는데 ECPay 가 모른다면 설정이 어긋난 것이고, 부분
   * 환불이면 주문이 살아 있어 발표가 뒤늦게 전액으로 나갈 수 있다 — 둘 다 실패로 남겨 다시 본다.
   */
  private closeNotIssued(
    invoice: OrderInvoiceEntity,
    state: EcpayInvoiceResultDto,
    isFullRefund: boolean,
  ): Promise<OrderInvoiceEntity> {
    const neverIssued =
      state.rtnCode === EcpayInvoiceRtnCode.NOT_FOUND &&
      invoice.status !== InvoiceStatus.ISSUED;

    return neverIssued && isFullRefund
      ? this.finish(invoice, InvoiceAdjustStatus.NONE)
      : this.fail(invoice, String(state.rtnCode), state.rtnMsg);
  }

  private async request(
    invoice: OrderInvoiceEntity,
    { total, refunded }: Pick<RefundTotals, 'total' | 'refunded'>,
    state: EcpayInvoiceResultDto,
    now: Date,
  ): Promise<OrderInvoiceEntity> {
    const isFull = refunded >= total;

    // 남은 금액을 모르면 얼마가 이미 折讓 됐는지 모른다. 전액 환불은 "折讓 없음"으로 봐도
    // 되지만(틀리면 ECPay 가 거절), 부분 환불은 같은 금액을 두 번 折讓 할 수 있어 멈춘다
    if (state.remainAllowanceAmount === null && !isFull) {
      return this.fail(invoice, 'UNKNOWN_REMAIN', 'no remain allowance amount');
    }

    const remain = state.remainAllowanceAmount ?? total;
    const allowanced = Math.max(0, total - remain);
    // 환불 합계 중 아직 발표에 반영되지 않은 금액. 발표에 남은 금액을 넘지 않는다
    const need = Math.min(refunded - allowanced, remain);

    if (need <= 0) {
      return this.finishAllowanced(invoice, refunded);
    }

    // 이미 일부 折讓 된 발표는 作廢 할 수 없다 — 남은 금액을 折讓 한다
    const canVoid =
      isFull &&
      allowanced === 0 &&
      now.getTime() <= getVoidDeadline(invoice.invoiceDate).getTime();

    let result: EcpayInvoiceAdjustResultDto;

    try {
      result = canVoid
        ? await this.void(invoice)
        : await this.allow(invoice, need, isFull);
    } catch (error) {
      return this.fail(invoice, 'NETWORK', String(error));
    }

    if (!result.isDone()) {
      return this.fail(invoice, String(result.rtnCode), result.rtnMsg);
    }

    return canVoid
      ? this.finish(invoice, InvoiceAdjustStatus.VOIDED)
      : this.finishAllowanced(invoice, refunded, result.allowanceNo);
  }

  private void(invoice: OrderInvoiceEntity) {
    return this.ecpayInvoiceService.invalid(
      invoice.invoiceNo,
      toTaipeiDate(invoice.invoiceDate),
      ADJUST_REASON,
    );
  }

  private allow(invoice: OrderInvoiceEntity, amount: number, isFull: boolean) {
    const date = toTaipeiDate(invoice.invoiceDate);

    return this.ecpayInvoiceService.allowance(
      isFull
        ? buildAllowanceData(invoice, amount, date, ADJUST_REASON)
        : buildAllowanceData(
            invoice,
            amount,
            date,
            PARTIAL_REASON,
            PARTIAL_REASON,
          ),
    );
  }

  /** 발행 결과를 모른 채 남아 있던 발표를 ECPay 조회 결과에 맞춘다 */
  private async syncIssued(
    invoice: OrderInvoiceEntity,
    state: EcpayInvoiceResultDto,
  ) {
    if (invoice.status === InvoiceStatus.ISSUED) {
      return;
    }

    invoice.status = InvoiceStatus.ISSUED;
    invoice.invoiceNo = state.invoiceNo;
    invoice.invoiceDate =
      parseTaipeiDateTime(state.invoiceDate ?? undefined) ?? new Date();
    invoice.randomNumber = state.randomNumber;

    await this.orderRepositoryService.updateInvoiceFields(invoice.orderId, {
      status: invoice.status,
      invoiceNo: invoice.invoiceNo,
      invoiceDate: invoice.invoiceDate,
      randomNumber: invoice.randomNumber,
    });
  }

  private async finish(
    invoice: OrderInvoiceEntity,
    status: InvoiceAdjustStatus,
    allowanceNo?: string | null,
  ): Promise<OrderInvoiceEntity> {
    const adjusted = status !== InvoiceAdjustStatus.NONE;

    invoice.adjustStatus = status;
    invoice.adjustedAt = adjusted ? new Date() : null;
    invoice.allowanceNo = allowanceNo ?? invoice.allowanceNo ?? null;
    invoice.adjustFailureCode = null;
    invoice.adjustFailureMessage = null;

    await this.saveAdjustFields(invoice);

    if (adjusted) {
      await this.log(
        invoice.orderId,
        OrderEventType.INVOICE_ADJUSTED,
        `${status} ${invoice.invoiceNo ?? ''} ${invoice.allowanceNo ?? ''}`,
      );
    }

    return invoice;
  }

  private async fail(
    invoice: OrderInvoiceEntity,
    code: string,
    message: string,
  ): Promise<OrderInvoiceEntity> {
    invoice.adjustStatus = InvoiceAdjustStatus.FAILED;
    invoice.adjustFailureCode = code.slice(0, 50);
    invoice.adjustFailureMessage = message.slice(0, 255);

    await this.saveAdjustFields(invoice);

    this.logger.error(
      `[발표 정정 실패 — 확인 필요] orderId=${invoice.orderId} attempt=${invoice.adjustAttemptCount} ${code} ${message}`,
    );
    await this.log(
      invoice.orderId,
      OrderEventType.INVOICE_ADJUST_FAILED,
      `${code} ${message}`,
    );

    return invoice;
  }

  /** 정정 칸만 고친다 — 발행 쪽이 쓰는 칸을 덮지 않는다 */
  private async saveAdjustFields(invoice: OrderInvoiceEntity) {
    await this.orderRepositoryService.updateInvoiceFields(invoice.orderId, {
      adjustStatus: invoice.adjustStatus,
      adjustAttemptCount: invoice.adjustAttemptCount,
      adjustedAt: invoice.adjustedAt,
      allowanceNo: invoice.allowanceNo,
      adjustFailureCode: invoice.adjustFailureCode,
      adjustFailureMessage: invoice.adjustFailureMessage,
    });
  }

  private async log(orderId: number, type: OrderEventType, message: string) {
    await this.orderRepositoryService.saveEvents([
      { orderId, type, adminId: null, userId: null, message: message.trim() },
    ]);
  }
}

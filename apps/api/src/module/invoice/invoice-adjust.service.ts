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
import { OrderEventType } from '@app/repository/enum/order.enum';
import { RefundStatus } from '@app/repository/enum/refund.enum';
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
const OPEN_STATUSES = [InvoiceAdjustStatus.PENDING, InvoiceAdjustStatus.FAILED];

/**
 * 환불이 끝난 주문의 전자발표 정정 (명세 v6 §8.4).
 *
 * 환불(PG)과 따로 돈다 — 정정이 실패해도 환불을 다시 하지 않고 정정만 다시 시도한다.
 * 신고 기한 안이면 作廢, 지났으면 남은 금액 전부를 折讓 한다. 요청 전에 ECPay 에 현재 상태를
 * 물어 이미 처리된 발표를 두 번 정정하지 않는다. 발행과 같은 락을 써서 발행 중인 발표를
 * 동시에 건드리지 않고, 저장은 정정 칸만 고친다.
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

    const refund = await this.refundRepositoryService.findByOrderId(orderId);

    if (refund?.status !== RefundStatus.COMPLETED) {
      return invoice;
    }

    // 발행을 한 번도 요청하지 않았다 — 정정할 발표가 없다
    if (!invoice.relateNumber) {
      return this.finish(invoice, InvoiceAdjustStatus.NONE);
    }

    invoice.adjustAttemptCount += 1;

    let state: EcpayInvoiceResultDto;

    try {
      state = await this.ecpayInvoiceService.getIssue(invoice.relateNumber);
    } catch (error) {
      return this.fail(invoice, 'NETWORK', String(error));
    }

    if (!state.isIssued()) {
      return this.closeNotIssued(invoice, state);
    }

    await this.syncIssued(invoice, state);

    if (state.isVoided) {
      return this.finish(invoice, InvoiceAdjustStatus.VOIDED);
    }

    if (state.remainAllowanceAmount === 0) {
      return this.finish(invoice, InvoiceAdjustStatus.ALLOWANCED);
    }

    return this.request(invoice, refund.amount, state, now);
  }

  /**
   * ECPay 에 발표가 없다. 우리도 발행된 적이 없다고 알고 있을 때만 "정정할 것 없음"이다 —
   * 발행됐다고 기록돼 있는데 ECPay 가 모른다면 설정이 어긋난 것이라 사람이 봐야 한다.
   */
  private closeNotIssued(
    invoice: OrderInvoiceEntity,
    state: EcpayInvoiceResultDto,
  ): Promise<OrderInvoiceEntity> {
    const neverIssued =
      state.rtnCode === EcpayInvoiceRtnCode.NOT_FOUND &&
      invoice.status !== InvoiceStatus.ISSUED;

    return neverIssued
      ? this.finish(invoice, InvoiceAdjustStatus.NONE)
      : this.fail(invoice, String(state.rtnCode), state.rtnMsg);
  }

  private async request(
    invoice: OrderInvoiceEntity,
    refundAmount: number,
    state: EcpayInvoiceResultDto,
    now: Date,
  ): Promise<OrderInvoiceEntity> {
    // 折讓 은 환불액과 발표에 남은 금액 중 작은 쪽까지만 한다
    const remain = Math.min(
      state.remainAllowanceAmount ?? refundAmount,
      refundAmount,
    );
    // 이미 일부 折讓 된 발표는 作廢 할 수 없다 — 남은 금액을 折讓 한다
    const canVoid =
      remain >= refundAmount &&
      now.getTime() <= getVoidDeadline(invoice.invoiceDate).getTime();
    const date = toTaipeiDate(invoice.invoiceDate);

    let result: EcpayInvoiceAdjustResultDto;

    try {
      result = canVoid
        ? await this.ecpayInvoiceService.invalid(
            invoice.invoiceNo,
            date,
            ADJUST_REASON,
          )
        : await this.ecpayInvoiceService.allowance(
            buildAllowanceData(invoice, remain, date, ADJUST_REASON),
          );
    } catch (error) {
      return this.fail(invoice, 'NETWORK', String(error));
    }

    if (!result.isDone()) {
      return this.fail(invoice, String(result.rtnCode), result.rtnMsg);
    }

    return this.finish(
      invoice,
      canVoid ? InvoiceAdjustStatus.VOIDED : InvoiceAdjustStatus.ALLOWANCED,
      result.allowanceNo,
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

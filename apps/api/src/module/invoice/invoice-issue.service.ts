import { CacheService } from '@app/cache/cache.service';
import { Configuration } from '@app/config/configuration';
import { SupportEnv } from '@app/config/enum/config.enum';
import {
  EcpayInvoiceResultDto,
  EcpayInvoiceRtnCode,
} from '@app/external/ecpay/ecpay-invoice.dto';
import { ExternalEcpayInvoiceService } from '@app/external/ecpay/ecpay-invoice.service';
import { parseTaipeiDateTime } from '@app/external/ecpay/ecpay.date';
import { OrderInvoiceEntity } from '@app/repository/entity/order-invoice.entity';
import { OrderEntity } from '@app/repository/entity/order.entity';
import { InvoiceStatus, InvoiceType } from '@app/repository/enum/invoice.enum';
import { OrderStatus } from '@app/repository/enum/order.enum';
import { OrderRepositoryService } from '@app/repository/service/order.repository.service';
import { UserRepositoryService } from '@app/repository/service/user.repository.service';
import { Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { randomUUID } from 'crypto';

import {
  buildIssueData,
  buildRelateNumber,
  normalizeTaiwanPhone,
} from './invoice.util';

/**
 * 재시도 상한. 5분 → 10분 → 20분 … 최대 6시간 간격이라 10번이면 하루 남짓이다
 * (간격 계산은 OrderRepositoryService.findInvoicesToIssue 가 DB 에서 한다).
 * ECPay 장애가 길어도 그 사이 결제된 주문의 발표가 굳지 않게 넉넉히 둔다.
 */
export const INVOICE_MAX_ATTEMPTS = 10;
/** ECPay 호출 두 번(조회 + 발행, 각 15초 타임아웃)보다 넉넉히 */
const ISSUE_LOCK_SECONDS = 120;
/** 발표 행이 없는 결제 주문을 찾는 범위 */
const MISSING_INVOICE_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 결제 확정 후 전자발표 발행.
 *
 * 결제 확정 커밋 직후(PaymentCompletionService)와 배치 재시도가 같은 주문을 동시에 집을 수
 * 있어 Redis 락으로 한 번에 하나만 돈다. ECPay 쪽 멱등 키는 RelateNumber 다 — 결과를
 * 모르는 재시도는 같은 번호로 조회부터 해서 이중 발행을 막는다.
 * 상태는 ISSUED 를 절대 되돌리지 않는다 (늦게 끝난 작업이 FAILED 로 덮지 못하게 조건부 UPDATE).
 * 실패해도 결제는 그대로 둔다. 발표는 결제와 따로 다시 시도할 수 있다.
 */
@Injectable()
export class InvoiceIssueService {
  private readonly logger = new Logger(InvoiceIssueService.name);

  constructor(
    private readonly orderRepositoryService: OrderRepositoryService,
    private readonly userRepositoryService: UserRepositoryService,
    private readonly ecpayInvoiceService: ExternalEcpayInvoiceService,
    private readonly cacheService: CacheService,
  ) {}

  async issueForOrder(orderId: number): Promise<OrderInvoiceEntity | null> {
    const key = `invoice_issue_lock:${orderId}`;
    const owner = randomUUID();
    const locked = await this.cacheService
      .setIfAbsent(key, owner, ISSUE_LOCK_SECONDS)
      .catch(() => false);

    if (!locked) {
      return null;
    }

    try {
      return await this.issue(orderId);
    } finally {
      await this.cacheService.deleteIfValue(key, owner).catch(() => undefined);
    }
  }

  /** 결제는 됐는데 발표가 안 나간 주문 (배치). 실패 횟수에 따라 간격을 늘린다 */
  async retryPending(now: Date = new Date()): Promise<void> {
    const [retries, missing] = await Promise.all([
      this.orderRepositoryService.findInvoicesToIssue(
        INVOICE_MAX_ATTEMPTS,
        now,
      ),
      this.orderRepositoryService.findPaidOrderIdsWithoutInvoice(
        new Date(now.getTime() - MISSING_INVOICE_LOOKBACK_MS),
      ),
    ]);
    const orderIds = [...retries.map((invoice) => invoice.orderId), ...missing];

    for (const orderId of orderIds) {
      await this.issueForOrder(orderId).catch((error) =>
        this.logger.error(`invoice retry failed: orderId=${orderId} ${error}`),
      );
    }
  }

  private async issue(orderId: number): Promise<OrderInvoiceEntity | null> {
    const order = await this.orderRepositoryService.findById(orderId);

    if (!order || order.status !== OrderStatus.PAID) {
      return null;
    }

    const invoice =
      (await this.orderRepositoryService.findInvoiceByOrderId(orderId)) ??
      (await this.createDefaultInvoice(order));

    if (invoice.status === InvoiceStatus.ISSUED) {
      return invoice;
    }

    // 이전 시도의 결과를 모르면(타임아웃 등) 같은 번호로 이미 발행됐는지부터 본다
    if (invoice.relateNumber && invoice.attemptCount > 0) {
      const found = await this.find(invoice.relateNumber);

      if (found?.isIssued()) {
        return this.markIssued(invoice, found);
      }
    }

    return this.requestIssue(order, invoice);
  }

  /** RelateNumber 를 먼저 저장하고 부른다 — 응답을 못 받아도 다음 시도가 같은 번호로 조회할 수 있다 */
  private async requestIssue(
    order: OrderEntity,
    invoice: OrderInvoiceEntity,
  ): Promise<OrderInvoiceEntity> {
    invoice.relateNumber ??= this.newRelateNumber(order.id);
    invoice.attemptCount += 1;
    invoice.lastAttemptAt = new Date();

    const stillOpen =
      await this.orderRepositoryService.updateInvoiceUnlessIssued(order.id, {
        relateNumber: invoice.relateNumber,
        attemptCount: invoice.attemptCount,
        lastAttemptAt: invoice.lastAttemptAt,
      });

    if (!stillOpen) {
      return invoice;
    }

    const items = await this.orderRepositoryService.findItemsByOrderId(
      order.id,
    );

    let result: EcpayInvoiceResultDto;

    try {
      result = await this.ecpayInvoiceService.issue(
        buildIssueData(order, items, invoice, invoice.relateNumber),
      );
    } catch (error) {
      return this.markFailed(invoice, 'NETWORK', String(error));
    }

    if (result.isIssued()) {
      return this.markIssued(invoice, result);
    }

    if (result.rtnCode === EcpayInvoiceRtnCode.DUPLICATE_RELATE_NUMBER) {
      const found = await this.find(invoice.relateNumber);

      if (found?.isIssued()) {
        return this.markIssued(invoice, found);
      }
    }

    return this.markFailed(invoice, String(result.rtnCode), result.rtnMsg);
  }

  /**
   * 이 기능 전에 만들어진 주문은 order_invoice 가 없다. 결제되면 ECPay 회원 載具로
   * 발행할 수 있게 회원 이메일·받는 분 휴대폰으로 만든다.
   */
  private async createDefaultInvoice(
    order: OrderEntity,
  ): Promise<OrderInvoiceEntity> {
    const [user, detail] = await Promise.all([
      this.userRepositoryService.findUserById(order.userId),
      this.orderRepositoryService.findDetailByIdAndUserId(
        order.id,
        order.userId,
      ),
    ]);

    return this.orderRepositoryService.saveInvoice(
      plainToInstance(OrderInvoiceEntity, {
        orderId: order.id,
        type: InvoiceType.MEMBER_CARRIER,
        customerEmail: user?.email || null,
        customerPhone: normalizeTaiwanPhone(detail?.shipping?.phone) || null,
        status: InvoiceStatus.PENDING,
        attemptCount: 0,
      }),
    );
  }

  private async find(
    relateNumber: string,
  ): Promise<EcpayInvoiceResultDto | null> {
    try {
      return await this.ecpayInvoiceService.getIssue(relateNumber);
    } catch {
      return null;
    }
  }

  private async markIssued(
    invoice: OrderInvoiceEntity,
    result: EcpayInvoiceResultDto,
  ): Promise<OrderInvoiceEntity> {
    invoice.status = InvoiceStatus.ISSUED;
    invoice.invoiceNo = result.invoiceNo;
    invoice.invoiceDate =
      parseTaipeiDateTime(result.invoiceDate ?? undefined) ?? new Date();
    invoice.randomNumber = result.randomNumber;
    invoice.failureCode = null;
    invoice.failureMessage = null;

    return this.orderRepositoryService.saveInvoice(invoice);
  }

  private async markFailed(
    invoice: OrderInvoiceEntity,
    code: string,
    message: string,
  ): Promise<OrderInvoiceEntity> {
    invoice.status = InvoiceStatus.FAILED;
    invoice.failureCode = code.slice(0, 50);
    invoice.failureMessage = message.slice(0, 255);

    await this.orderRepositoryService.updateInvoiceUnlessIssued(
      invoice.orderId,
      {
        status: invoice.status,
        failureCode: invoice.failureCode,
        failureMessage: invoice.failureMessage,
      },
    );

    const final = invoice.attemptCount >= INVOICE_MAX_ATTEMPTS;
    this.logger[final ? 'error' : 'warn'](
      `[${final ? '발표 발행 포기 — 확인 필요' : '발표 발행 실패'}] orderId=${invoice.orderId} attempt=${invoice.attemptCount} ${code} ${message}`,
    );

    return invoice;
  }

  private newRelateNumber(orderId: number): string {
    const config = Configuration.getConfig();

    return buildRelateNumber(
      config.PAYMENT_TRADE_NO_PREFIX,
      orderId,
      config.NODE_ENV === SupportEnv.PROD,
    );
  }
}

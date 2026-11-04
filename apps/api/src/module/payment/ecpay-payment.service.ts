import { SupportEnv } from '@app/config/enum/config.enum';
import {
  formatTaipeiDateTime,
  parseTaipeiDateTime,
} from '@app/external/ecpay/ecpay.date';
import { EcpayLanguage, EcpayRtnCode } from '@app/external/ecpay/ecpay.dto';
import { ExternalEcpayService } from '@app/external/ecpay/ecpay.service';
import {
  PaymentDepositInfo,
  PaymentEntity,
} from '@app/repository/entity/payment.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { OrderStatus, PaymentMethod } from '@app/repository/enum/order.enum';
import {
  PaymentEventSource,
  PaymentStatus,
} from '@app/repository/enum/payment.enum';
import { OrderRepositoryService } from '@app/repository/service/order.repository.service';
import { PaymentRepositoryService } from '@app/repository/service/payment.repository.service';
import { Injectable, Logger } from '@nestjs/common';

import { PaymentCompletionService } from './payment-completion.service';
import { PaymentResultService } from './payment-result.service';
import {
  CALLBACK_MAX_FIELDS,
  CALLBACK_MAX_VALUE_LENGTH,
  DEPOSIT_FORCE_EXPIRE_HOURS,
  ECPAY_ATM_EXPIRE_DAYS,
  ECPAY_CHECKOUT_MINUTES,
  ECPAY_CVS_EXPIRE_MINUTES,
  ECPAY_FORCE_EXPIRE_HOURS,
  ECPAY_IGNORE_PAYMENTS,
  HANDOFF_TTL_MINUTES,
} from './payment.constant';
import {
  renderAutoSubmitPage,
  renderHandoffLandingPage,
  renderMessagePage,
} from './payment.html';
import { minutesAgo } from './payment.util';

export const ECPAY_OK = '1|OK';
const ECPAY_BAD_REQUEST = '0|Bad Request';

export interface HtmlPage {
  status: number;
  html: string;
}

/** ECPay 에 물어본 결과. unknown 이면 아무것도 정하지 않는다 */
type QueryOutcome = 'paid' | 'unpaid' | 'unknown';

const LANGUAGE: Partial<Record<string, EcpayLanguage>> = {
  [LanguageCode.KOREAN]: 'KOR',
  [LanguageCode.ENGLISH]: 'ENG',
};

/** 모의 결제(SimulatePaid)를 받아들이는 환경. 알 수 없는 NODE_ENV 는 받지 않는다 */
const SIMULATED_PAYMENT_ENVS: string[] = [
  SupportEnv.LOCAL,
  SupportEnv.DEV,
  SupportEnv.TEST,
];

/**
 * ECPay 통합결제 흐름.
 *
 * - handoff: 결제창 진입(form POST)을 서버가 그린 페이지로 대신한다. LINE 안에서
 *   외부 브라우저로 넘길 때 GET URL 하나로 열 수 있어야 해서다.
 * - ReturnURL: 결제 확정의 근거. 반드시 "1|OK" 만 돌려준다.
 * - PaymentInfoURL: ATM·편의점 번호 발급(取號). 결제 성공이 아니다.
 * - 배치: 통지를 놓쳤을 수 있는 건은 만료시키기 전에 QueryTradeInfo 로 확인한다.
 */
@Injectable()
export class EcpayPaymentService {
  private readonly logger = new Logger(EcpayPaymentService.name);

  constructor(
    private readonly ecpayService: ExternalEcpayService,
    private readonly paymentRepositoryService: PaymentRepositoryService,
    private readonly orderRepositoryService: OrderRepositoryService,
    private readonly paymentCompletionService: PaymentCompletionService,
    private readonly paymentResultService: PaymentResultService,
  ) {}

  /**
   * 같은 MerchantTradeNo 를 두 번 보내면 ECPay 가 거절하므로 한 번만 그린다.
   * 다시 결제하려면 결제 시작 API 로 새 시도를 만들어야 한다.
   */
  /**
   * handoff GET. 링크가 쓸 수 있는지만 보고 같은 주소로 POST 하는 페이지를 준다 — 1회 사용 처리는 하지 않는다.
   * Slack·카카오톡·LINE 의 링크 미리보기 봇이 GET 으로 먼저 열어도 링크가 소모되지 않게 하려는 것이다
   * (봇은 자바스크립트를 실행하지 않고 POST 하지 않는다).
   */
  async renderHandoffLanding(token: string): Promise<HtmlPage> {
    const found = await this.findOpenableHandoff(token);

    if ('html' in found) {
      return found;
    }

    return { status: 200, html: renderHandoffLandingPage() };
  }

  /** handoff POST. 여기서 한 번만 열리게 표시하고 ECPay 결제창으로 auto-submit 한다 */
  async renderHandoff(token: string): Promise<HtmlPage> {
    const found = await this.findOpenableHandoff(token);

    if ('html' in found) {
      return found;
    }

    const { payment } = found;
    const opened = await this.paymentRepositoryService.markHandoffOpened(
      payment.id,
    );

    if (!opened) {
      return this.page(
        409,
        '付款頁面已開啟過',
        '若尚未完成付款，請回到 LINE 或網站重新付款。',
      );
    }

    return {
      status: 200,
      html: renderAutoSubmitPage(await this.buildForm(payment)),
    };
  }

  async handleReturn(body: unknown): Promise<string> {
    const params = toCallbackParams(body);

    if (!params) {
      return ECPAY_BAD_REQUEST;
    }

    const payment = await this.verifyAndFind(
      params,
      PaymentEventSource.ECPAY_RETURN,
    );

    if (!payment) {
      return '0|Verification Failed';
    }

    const rejected = await this.rejectUnpayable(payment, params);

    if (rejected) {
      return rejected;
    }

    await this.paymentCompletionService.markPaid(payment.id, {
      pgTransactionId: params.TradeNo,
      pgPaymentType: params.PaymentType,
      paidAt: parseTaipeiDateTime(params.PaymentDate) ?? new Date(),
    });

    return ECPAY_OK;
  }

  /**
   * ReturnURL 을 결제 완료로 반영하면 안 되는 경우의 응답. 반영해도 되면 null.
   * - 성공 코드가 아님: 결제 보류("付款結果待確認") 같은 코드도 있어 상태는 바꾸지 않고
   *   기록만 남긴다 — 실패 판정은 배치가 ECPay 에 물어서 한다
   * - 금액 불일치: "0|" 로 답해 ECPay 가 다시 보내게 하고 사람이 본다
   * - 운영의 모의 결제: 받았다고만 답한다
   */
  private async rejectUnpayable(
    payment: PaymentEntity,
    params: Record<string, string>,
  ): Promise<string | null> {
    if (params.RtnCode !== EcpayRtnCode.PAID) {
      await this.attention(
        payment,
        params,
        `RETURN_NOT_PAID RtnCode=${params.RtnCode}`,
      );

      return ECPAY_OK;
    }

    if (Number(params.TradeAmt) !== payment.amount) {
      await this.attention(
        payment,
        params,
        `AMOUNT_MISMATCH TradeAmt=${params.TradeAmt}`,
      );

      return '0|Amount Mismatch';
    }

    if (params.SimulatePaid === '1' && !this.isSimulatedPaymentAllowed()) {
      await this.attention(payment, params, 'SIMULATE_PAID_IGNORED');

      return ECPAY_OK;
    }

    return null;
  }

  async handlePaymentInfo(body: unknown): Promise<string> {
    const params = toCallbackParams(body);

    if (!params) {
      return ECPAY_BAD_REQUEST;
    }

    const payment = await this.verifyAndFind(
      params,
      PaymentEventSource.ECPAY_PAYMENT_INFO,
    );

    if (!payment) {
      return '0|Verification Failed';
    }

    const issued =
      params.RtnCode === EcpayRtnCode.ATM_ISSUED ||
      params.RtnCode === EcpayRtnCode.CVS_ISSUED;

    if (!issued) {
      await this.paymentCompletionService.failAttempt(
        payment.id,
        PaymentStatus.FAILED,
        { code: params.RtnCode, message: params.RtnMsg },
      );

      return ECPAY_OK;
    }

    await this.paymentCompletionService.markWaitingDeposit(payment.id, {
      pgTransactionId: params.TradeNo,
      pgPaymentType: params.PaymentType,
      depositInfo: toDepositInfo(params),
      // 기한을 못 읽으면 우리 쪽 기한으로라도 잡는다 — null 이면 만료 배치가 영영 집지 않는다
      expireAt:
        parseTaipeiDateTime(params.ExpireDate) ??
        defaultDepositExpireAt(params.PaymentType),
    });

    return ECPAY_OK;
  }

  /**
   * OrderResultURL · ClientRedirectURL (브라우저). 상태는 바꾸지 않는다.
   * 검증을 통과해야만 결제를 돌려준다 — 결과 토큰이 붙은 주소로 보내기 때문이다.
   */
  async resolveBrowserReturn(body: unknown): Promise<PaymentEntity | null> {
    const params = toCallbackParams(body);

    if (!params || !this.ecpayService.verifyCallback(params)) {
      this.logger.warn('browser-return rejected (shape or CheckMacValue)');

      return null;
    }

    return this.paymentRepositoryService.findByMerchantTradeNo(
      params.MerchantTradeNo,
    );
  }

  /**
   * 결제창으로 넘긴 뒤 오래 결과가 없는 시도 (배치).
   * 결제창을 열지도 않았으면 바로 만료. 열었으면 연 뒤 한 시간은 결제 중으로 보고,
   * 그 뒤 ECPay 에 물어서 정한다.
   */
  async reconcile(payment: PaymentEntity, now: Date = new Date()) {
    if (!payment.handoffOpenedAt) {
      await this.expire(payment, 'NOT_OPENED');

      return;
    }

    if (payment.handoffOpenedAt > minutesAgo(ECPAY_CHECKOUT_MINUTES, now)) {
      return;
    }

    const outcome = await this.queryAndSettle(payment, now);
    const forceAt = minutesAgo(ECPAY_FORCE_EXPIRE_HOURS * 60, now);

    if (outcome === 'unpaid') {
      await this.expire(payment, 'ABANDONED');
    } else if (outcome === 'unknown' && payment.handoffOpenedAt < forceAt) {
      await this.expire(payment, 'QUERY_FAILED');
    }
  }

  /**
   * ATM·편의점 입금 기한이 지난 시도 (배치). ECPay 는 만료를 알려주지 않고,
   * ReturnURL 을 놓친 입금이 있을 수 있어서 만료 전에 한 번 묻는다.
   */
  async expireDeposit(payment: PaymentEntity, now: Date = new Date()) {
    const outcome = await this.queryAndSettle(payment, now);
    const forceAt = minutesAgo(DEPOSIT_FORCE_EXPIRE_HOURS * 60, now);
    const overdue = !payment.expireAt || payment.expireAt < forceAt;

    if (outcome === 'unpaid' || (outcome === 'unknown' && overdue)) {
      await this.paymentCompletionService.failAttempt(
        payment.id,
        PaymentStatus.EXPIRED,
        { code: 'DEPOSIT_EXPIRED', message: `query=${outcome}` },
      );
    }
  }

  /** dev·test 에서는 상점 관리 화면의 모의 결제로 흐름을 확인해야 해서 받아들인다 */
  isSimulatedPaymentAllowed(): boolean {
    return SIMULATED_PAYMENT_ENVS.includes(process.env.NODE_ENV ?? '');
  }

  /** 결제됐으면 반영한다. 검증 안 된 응답·금액 불일치·호출 실패는 unknown */
  private async queryAndSettle(
    payment: PaymentEntity,
    now: Date,
  ): Promise<QueryOutcome> {
    const info = await this.ecpayService
      .queryTradeInfo(payment.merchantTradeNo)
      .catch((error) => {
        this.logger.warn(
          `QueryTradeInfo failed: ${payment.merchantTradeNo} ${error}`,
        );

        return null;
      });

    if (!info || !info.verified) {
      return 'unknown';
    }

    await this.paymentRepositoryService.saveEvent(
      payment.id,
      PaymentEventSource.ECPAY_QUERY,
      info.raw,
    );

    if (!info.isPaid()) {
      return 'unpaid';
    }

    if (info.tradeAmount !== payment.amount) {
      await this.attention(
        payment,
        info.raw,
        `QUERY_AMOUNT_MISMATCH TradeAmt=${info.tradeAmount}`,
      );

      return 'unknown';
    }

    await this.paymentCompletionService.markPaid(payment.id, {
      pgTransactionId: info.tradeNo,
      pgPaymentType: info.paymentType,
      paidAt: parseTaipeiDateTime(info.paymentDate) ?? now,
    });

    return 'paid';
  }

  private async buildForm(payment: PaymentEntity) {
    const items = await this.orderRepositoryService.findItemsByOrderId(
      payment.orderId,
    );
    const order = await this.orderRepositoryService.findById(payment.orderId);
    const itemNames = items.map(
      (item) => `${item.productNameSnapshot ?? 'Item'} x ${item.quantity}`,
    );

    if (order && order.shippingFeeApplied > 0) {
      itemNames.push('運費 x 1');
    }

    const browserReturnUrl = this.paymentResultService.callbackUrl(
      '/payment/ecpay/browser-return',
    );

    return this.ecpayService.buildCheckoutForm({
      merchantTradeNo: payment.merchantTradeNo,
      tradeDate: new Date(),
      totalAmount: payment.amount,
      tradeDesc: `Seoul Moment ${order?.orderNumber ?? ''}`.trim(),
      itemNames,
      returnUrl: this.paymentResultService.callbackUrl('/payment/ecpay/return'),
      orderResultUrl: browserReturnUrl,
      clientRedirectUrl: browserReturnUrl,
      paymentInfoUrl: this.paymentResultService.callbackUrl(
        '/payment/ecpay/payment-info',
      ),
      language: payment.locale ? LANGUAGE[payment.locale] : undefined,
      atmExpireDays: ECPAY_ATM_EXPIRE_DAYS,
      cvsExpireMinutes: ECPAY_CVS_EXPIRE_MINUTES,
      ignorePayments: ECPAY_IGNORE_PAYMENTS,
    });
  }

  /**
   * 서명이 맞으면 원문을, 틀리면 요약만 남긴다 — 인증 없는 요청으로 DB 를 부풀리지 못하게.
   */
  private async verifyAndFind(
    params: Record<string, string>,
    source: PaymentEventSource,
  ): Promise<PaymentEntity | null> {
    if (!this.ecpayService.verifyCallback(params)) {
      await this.paymentRepositoryService.saveEvent(
        null,
        source,
        summarize(params),
        'CheckMacValue mismatch',
      );

      return null;
    }

    const payment = await this.paymentRepositoryService.findByMerchantTradeNo(
      params.MerchantTradeNo,
    );

    await this.paymentRepositoryService.saveEvent(
      payment?.id ?? null,
      source,
      params,
      payment ? undefined : 'Unknown MerchantTradeNo',
    );

    return payment?.method === PaymentMethod.ECPAY ? payment : null;
  }

  private async expire(payment: PaymentEntity, reason: string) {
    await this.paymentCompletionService.failAttempt(
      payment.id,
      PaymentStatus.EXPIRED,
      { code: 'EXPIRED', message: reason },
    );
  }

  private async attention(
    payment: PaymentEntity,
    params: Record<string, string>,
    note: string,
  ) {
    this.logger.error(`[결제 확인 필요] paymentId=${payment.id} ${note}`);
    await this.paymentRepositoryService.saveEvent(
      payment.id,
      PaymentEventSource.NEEDS_ATTENTION,
      params,
      note,
    );
  }

  /** 결제창을 열 수 있는 시도인지. 아니면 보여줄 안내 페이지를 돌려준다 */
  private async findOpenableHandoff(
    token: string,
  ): Promise<{ payment: PaymentEntity } | HtmlPage> {
    const payment =
      await this.paymentRepositoryService.findByAccessToken(token);

    if (!payment || payment.method !== PaymentMethod.ECPAY) {
      return this.page(404, '付款連結無效', '請回到 LINE 或網站重新付款。');
    }

    const expired =
      !payment.requestedAt ||
      payment.requestedAt < minutesAgo(HANDOFF_TTL_MINUTES);
    const order = await this.orderRepositoryService.findById(payment.orderId);

    // 다른 시도로 이미 결제됐거나 취소된 주문이면 결제창을 열지 않는다 (이중 결제 방지)
    if (
      payment.status !== PaymentStatus.REQUESTED ||
      expired ||
      order?.status !== OrderStatus.PENDING
    ) {
      return this.page(410, '付款連結已失效', '請回到 LINE 或網站確認訂單。');
    }

    return { payment };
  }

  private page(status: number, title: string, message: string): HtmlPage {
    return { status, html: renderMessagePage(title, message) };
  }
}

/**
 * form 으로 온 값을 문자열 맵으로 맞춘다. CheckMacValue 는 받은 그대로 계산해야 한다.
 * 객체가 아니거나(text/plain 문자열 등) 필드·값이 지나치게 크면 null — 서명 계산 전에 거절한다.
 */
export function toCallbackParams(body: unknown): Record<string, string> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  const entries = Object.entries(body as Record<string, unknown>);

  if (entries.length > CALLBACK_MAX_FIELDS) {
    return null;
  }

  const params: Record<string, string> = {};

  for (const [key, value] of entries) {
    if (typeof value === 'object' && value !== null) {
      return null;
    }

    const text = String(value ?? '');

    if (key.length > 100 || text.length > CALLBACK_MAX_VALUE_LENGTH) {
      return null;
    }

    params[key] = text;
  }

  // 거래번호·서명이 없으면 ECPay 콜백이 아니다
  if (!params.MerchantTradeNo || !params.CheckMacValue) {
    return null;
  }

  return params;
}

function summarize(params: Record<string, string>): Record<string, unknown> {
  return {
    MerchantTradeNo: (params.MerchantTradeNo ?? '').slice(0, 20),
    RtnCode: (params.RtnCode ?? '').slice(0, 20),
    keys: Object.keys(params).slice(0, 50),
  };
}

/** ECPay 와 같게: ATM 은 N일 뒤 그날 23:59:59(대만), 편의점 코드는 지금부터 N분 */
function defaultDepositExpireAt(paymentType: string | undefined): Date {
  if ((paymentType ?? '').startsWith('ATM')) {
    const day = new Date(
      Date.now() + ECPAY_ATM_EXPIRE_DAYS * 24 * 60 * 60 * 1000,
    );

    return parseTaipeiDateTime(formatTaipeiDateTime(day).slice(0, 10)) ?? day;
  }

  return new Date(Date.now() + ECPAY_CVS_EXPIRE_MINUTES * 60 * 1000);
}

function toDepositInfo(params: Record<string, string>): PaymentDepositInfo {
  const info: PaymentDepositInfo = { paymentType: params.PaymentType };

  if (params.vAccount) {
    info.bankCode = params.BankCode;
    info.account = params.vAccount;
  }

  if (params.PaymentNo) {
    info.paymentNo = params.PaymentNo;
  }

  const barcodes = [params.Barcode1, params.Barcode2, params.Barcode3].filter(
    (code) => !!code,
  );

  if (barcodes.length > 0) {
    info.barcodes = barcodes;
  }

  return info;
}

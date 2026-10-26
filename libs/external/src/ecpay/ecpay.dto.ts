/** ECPay 콜백의 RtnCode 중 우리가 분기하는 값 */
export const EcpayRtnCode = {
  /** 결제 성공 (ReturnURL) */
  PAID: '1',
  /** ATM 가상계좌 발급 성공 (PaymentInfoURL) */
  ATM_ISSUED: '2',
  /** 편의점 코드 · 바코드 발급 성공 (PaymentInfoURL) */
  CVS_ISSUED: '10100073',
} as const;

/** QueryTradeInfo 의 TradeStatus */
export const EcpayTradeStatus = {
  UNPAID: '0',
  PAID: '1',
} as const;

/** ECPay 결제창 언어. 번체 중문은 기본값이라 보내지 않는다 */
export type EcpayLanguage = 'KOR' | 'ENG';

export interface EcpayCheckoutInput {
  merchantTradeNo: string;
  tradeDate: Date;
  totalAmount: number;
  tradeDesc: string;
  itemNames: string[];
  returnUrl: string;
  orderResultUrl: string;
  clientRedirectUrl: string;
  paymentInfoUrl: string;
  clientBackUrl?: string;
  language?: EcpayLanguage;
  /** ATM 입금 기한 (일, 1–60) */
  atmExpireDays: number;
  /** 편의점 코드 입금 기한 (분). 바코드는 같은 파라미터를 일 단위로 읽으므로 바코드를 함께 쓰면 안 된다 */
  cvsExpireMinutes: number;
  /** 결제창에서 숨길 결제수단 (예: ['BARCODE']) */
  ignorePayments: string[];
}

export interface EcpayCheckoutForm {
  action: string;
  fields: Record<string, string>;
}

export class EcpayTradeInfoDto {
  tradeStatus: string;
  tradeAmount: number;
  tradeNo: string;
  paymentType: string;
  paymentDate: string;
  /** 응답 CheckMacValue 가 맞았는지. 틀리면 이 응답으로 아무것도 정하지 않는다 */
  verified: boolean;
  raw: Record<string, string>;

  static from(
    params: Record<string, string>,
    verified = true,
  ): EcpayTradeInfoDto {
    const dto = new EcpayTradeInfoDto();
    dto.tradeStatus = params.TradeStatus ?? '';
    dto.tradeAmount = Number(params.TradeAmt ?? 0);
    dto.tradeNo = params.TradeNo ?? '';
    dto.paymentType = params.PaymentType ?? '';
    dto.paymentDate = params.PaymentDate ?? '';
    dto.verified = verified;
    dto.raw = params;

    return dto;
  }

  isPaid(): boolean {
    return this.tradeStatus === EcpayTradeStatus.PAID;
  }

  isUnpaid(): boolean {
    return this.tradeStatus === EcpayTradeStatus.UNPAID;
  }
}

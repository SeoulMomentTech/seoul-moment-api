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

/**
 * 카드 請退款(DoAction)의 동작 (developers.ecpay.com.tw/2885).
 * C 關帳(매입 요청) · R 退刷(매입 금액에서 환불) · E 取消(매입 요청 취소) · N 放棄(승인 취소)
 */
export type EcpayCreditAction = 'C' | 'R' | 'E' | 'N';

/** 카드 거래 상태 (QueryTrade/V2 의 RtnValue.status) */
export const EcpayCreditStatus = {
  /** 승인만 됨 — 아직 매입 요청 전 (결제 당일 20:15 전) */
  AUTHORIZED: '已授權',
  /** 매입 요청됨 */
  CLOSING: '要關帳',
  /** 매입 완료 */
  CLOSED: '已關帳',
  /** 매입 요청을 취소함 — 승인만 남았다 */
  CLOSE_CANCELED: '操作取消',
  /** 승인 취소됨 — 결제 금액 전부가 돌아갔다 */
  CANCELED: '已取消',
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

interface EcpayCloseData {
  status?: string;
  amount?: string | number;
}

/**
 * 카드 거래 한 건의 상태 (QueryTrade/V2). 응답 모양은 2026-11-25 stage 실측:
 * {"RtnMsg":"","RtnValue":{"TradeID":"14788440","amount":"1000","clsamt":"0","status":"要關帳",
 *  "close_data":[{"sno":"1691666","status":"要關帳","amount":"1000",…},
 *                {"sno":"1691667","status":"要關帳","amount":"-600",…}]}}
 * - 退刷(R)은 여러 번 불러도 음수 한 줄에 합쳐진다. 승인 취소(N) 뒤에는 status 가
 *   已取消 이고 close_data 는 null 이다. 매입 취소(E)를 하면 음수 줄도 操作取消 이 된다.
 */
export class EcpayCreditTradeDto {
  /** 비어 있으면 성공 (error_Stop · error_nopay · error 는 실패) */
  rtnMsg: string;
  status: string;
  amount: number;
  /** 이미 고객에게 돌아간 금액 — 승인 취소면 전액, 아니면 살아 있는 退刷 합계 */
  refundedAmount: number;
  /** close_data 에 처음 보는 상태의 줄이 있다 — 환불 합계를 믿을 수 없다 */
  hasUnknownRow: boolean;
  raw: unknown;

  static fromJson(text: string): EcpayCreditTradeDto {
    const body = JSON.parse(text) as {
      RtnMsg?: string;
      RtnValue?: {
        amount?: string | number;
        status?: string;
        close_data?: EcpayCloseData[] | null;
      } | null;
    };
    const value = body.RtnValue || {};
    const dto = new EcpayCreditTradeDto();

    dto.rtnMsg = body.RtnMsg ?? '';
    dto.status = value.status ?? '';
    dto.amount = Number(value.amount ?? 0);
    dto.refundedAmount =
      dto.status === EcpayCreditStatus.CANCELED
        ? dto.amount
        : sumRefunded(value.close_data ?? []);
    dto.hasUnknownRow = (value.close_data ?? []).some(
      (row) => !KNOWN_STATUSES.includes(row.status ?? ''),
    );
    dto.raw = body;

    return dto;
  }

  /** 합계를 잘못 읽으면 같은 환불을 두 번 보내게 된다 — 모르는 줄이 있으면 실패로 본다 */
  isSuccess(): boolean {
    return this.rtnMsg === '' && this.status !== '' && !this.hasUnknownRow;
  }
}

const KNOWN_STATUSES: string[] = Object.values(EcpayCreditStatus);

function sumRefunded(closeData: EcpayCloseData[]): number {
  const alive: string[] = [EcpayCreditStatus.CLOSING, EcpayCreditStatus.CLOSED];

  return closeData
    .filter((row) => alive.includes(row.status ?? ''))
    .map((row) => Number(row.amount ?? 0))
    .filter((amount) => amount < 0)
    .reduce((sum, amount) => sum - amount, 0);
}

/** DoAction 응답 (form 문자열, CheckMacValue 없음). RtnCode 1 만 성공이다 */
export class EcpayCreditActionResultDto {
  rtnCode: string;
  rtnMsg: string;
  raw: Record<string, string>;

  static from(params: Record<string, string>): EcpayCreditActionResultDto {
    const dto = new EcpayCreditActionResultDto();

    dto.rtnCode = params.RtnCode ?? '';
    dto.rtnMsg = params.RtnMsg ?? '';
    dto.raw = params;

    return dto;
  }

  isSuccess(): boolean {
    return this.rtnCode === '1';
  }
}

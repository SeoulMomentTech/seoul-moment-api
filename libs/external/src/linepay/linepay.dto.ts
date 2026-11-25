export const LINE_PAY_SUCCESS = '0000';

/** 결제 상태 조회(check) API 의 returnCode */
export const LinePayCheckCode = {
  /** 사용자가 아직 승인 안 함 */
  NOT_AUTHORIZED: '0000',
  /** 승인 완료, Confirm 가능 */
  AUTHORIZED: '0110',
  /** 취소 또는 만료 */
  CANCELED_OR_EXPIRED: '0121',
  FAILED: '0122',
  /** 이미 결제 완료 */
  COMPLETED: '0123',
} as const;

export interface LinePayProduct {
  name: string;
  quantity: number;
  price: number;
}

export interface LinePayRequestInput {
  orderId: string;
  amount: number;
  packageId: string;
  products: LinePayProduct[];
  confirmUrl: string;
  cancelUrl: string;
}

export interface LinePayRawResponse<T = unknown> {
  returnCode: string;
  returnMessage: string;
  info?: T;
}

export interface LinePayRequestInfo {
  transactionId: string;
  paymentAccessToken?: string;
  paymentUrl?: { web?: string; app?: string };
}

export class LinePayRequestResultDto {
  returnCode: string;
  returnMessage: string;
  transactionId: string | null;
  paymentUrlWeb: string | null;
  paymentUrlApp: string | null;

  static from(
    response: LinePayRawResponse<LinePayRequestInfo>,
  ): LinePayRequestResultDto {
    const dto = new LinePayRequestResultDto();
    dto.returnCode = response.returnCode;
    dto.returnMessage = response.returnMessage;
    dto.transactionId = response.info?.transactionId
      ? String(response.info.transactionId)
      : null;
    dto.paymentUrlWeb = response.info?.paymentUrl?.web ?? null;
    dto.paymentUrlApp = response.info?.paymentUrl?.app ?? null;

    return dto;
  }

  isSuccess(): boolean {
    return (
      this.returnCode === LINE_PAY_SUCCESS &&
      !!this.transactionId &&
      !!this.paymentUrlWeb
    );
  }
}

export class LinePayResultDto {
  returnCode: string;
  returnMessage: string;

  static from(response: LinePayRawResponse): LinePayResultDto {
    const dto = new LinePayResultDto();
    dto.returnCode = response.returnCode;
    dto.returnMessage = response.returnMessage;

    return dto;
  }

  isSuccess(): boolean {
    return this.returnCode === LINE_PAY_SUCCESS;
  }
}

/** 이미 전액 환불된 거래에 다시 환불을 요청했을 때 */
export const LINE_PAY_ALREADY_REFUNDED = '1165';

export interface LinePayRefundInfo {
  refundTransactionId?: string;
  refundTransactionDate?: string;
}

export class LinePayRefundResultDto extends LinePayResultDto {
  refundTransactionId: string | null;

  static fromRefund(
    response: LinePayRawResponse<LinePayRefundInfo>,
  ): LinePayRefundResultDto {
    const dto = new LinePayRefundResultDto();
    dto.returnCode = response.returnCode;
    dto.returnMessage = response.returnMessage;
    dto.refundTransactionId = response.info?.refundTransactionId
      ? String(response.info.refundTransactionId)
      : null;

    return dto;
  }

  isAlreadyRefunded(): boolean {
    return this.returnCode === LINE_PAY_ALREADY_REFUNDED;
  }
}

export interface LinePayPaymentDetail {
  transactionId?: string;
  refundList?: { refundTransactionId?: string; refundAmount?: number }[];
}

/** 결제 조회(GET /v3/payments)에서 환불 내역만 뽑은 것 */
export class LinePayRefundLookupDto extends LinePayResultDto {
  /** 지금까지 환불된 합계 (양수) */
  refundedAmount: number;
  refundTransactionId: string | null;
  private entries: { transactionId: string | null; amount: number }[] = [];

  /** 이 금액으로 나간 환불의 거래번호. 이미 다른 환불에 적어 둔 번호는 건너뛴다 */
  findTransactionId(amount: number, known: string[] = []): string | null {
    const match = this.entries.find(
      (entry) =>
        entry.amount === amount &&
        !!entry.transactionId &&
        !known.includes(entry.transactionId),
    );

    return match?.transactionId ?? null;
  }

  static fromDetails(
    response: LinePayRawResponse<LinePayPaymentDetail[]>,
  ): LinePayRefundLookupDto {
    const refunds = (response.info ?? []).flatMap(
      (detail) => detail.refundList ?? [],
    );
    const dto = new LinePayRefundLookupDto();
    dto.returnCode = response.returnCode;
    dto.returnMessage = response.returnMessage;
    // refundAmount 는 음수로 온다
    dto.refundedAmount = refunds.reduce(
      (sum, refund) => sum + Math.abs(Number(refund.refundAmount ?? 0)),
      0,
    );
    dto.entries = refunds.map((refund) => ({
      transactionId: refund.refundTransactionId
        ? String(refund.refundTransactionId)
        : null,
      amount: Math.abs(Number(refund.refundAmount ?? 0)),
    }));
    dto.refundTransactionId = refunds[0]?.refundTransactionId
      ? String(refunds[0].refundTransactionId)
      : null;

    return dto;
  }
}

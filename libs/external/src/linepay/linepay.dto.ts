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

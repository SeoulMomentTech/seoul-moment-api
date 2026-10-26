export enum PaymentStatus {
  /** 행만 만들고 PG 요청 전 */
  READY = 'READY',
  /** PG 결제창으로 넘김. 사용자가 결제 중 */
  REQUESTED = 'REQUESTED',
  /** ECPay ATM·편의점 번호 발급(取號) 완료, 입금 대기 */
  WAITING_DEPOSIT = 'WAITING_DEPOSIT',
  PAID = 'PAID',
  FAILED = 'FAILED',
  /** 사용자가 결제창에서 취소했거나, 같은 주문으로 새 시도를 시작해 밀려났다 */
  CANCELED = 'CANCELED',
  /** 입금 기한 경과, 또는 결제창에서 이탈한 채 시간이 지났다 */
  EXPIRED = 'EXPIRED',
}

/** 결제 시도가 아직 끝나지 않은 상태 — 재고를 붙잡고 있는 시도다 */
export const ACTIVE_PAYMENT_STATUSES = [
  PaymentStatus.READY,
  PaymentStatus.REQUESTED,
  PaymentStatus.WAITING_DEPOSIT,
];

export enum PaymentEventSource {
  ECPAY_RETURN = 'ECPAY_RETURN',
  ECPAY_PAYMENT_INFO = 'ECPAY_PAYMENT_INFO',
  ECPAY_QUERY = 'ECPAY_QUERY',
  LINEPAY_REQUEST = 'LINEPAY_REQUEST',
  LINEPAY_CONFIRM = 'LINEPAY_CONFIRM',
  LINEPAY_CHECK = 'LINEPAY_CHECK',
  LINEPAY_CANCEL = 'LINEPAY_CANCEL',
  /** 결제는 됐는데 후처리가 실패해 사람이 봐야 하는 건 (재고 부족·중복 결제 등) */
  NEEDS_ATTENTION = 'NEEDS_ATTENTION',
}

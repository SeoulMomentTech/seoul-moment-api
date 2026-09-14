export enum OrderStatus {
  /** 결제 대기 — 주문서에서 생성된 직후 상태 */
  PENDING = 'PENDING',
  /** 입금 대기 — ECPay ATM·편의점 결제 선택 시 */
  PAYMENT_WAITING = 'PAYMENT_WAITING',
  PAID = 'PAID',
  CANCELED = 'CANCELED',
  FAILED = 'FAILED',
}

export enum PaymentMethod {
  LINE_PAY = 'LINE_PAY',
  ECPAY = 'ECPAY',
}

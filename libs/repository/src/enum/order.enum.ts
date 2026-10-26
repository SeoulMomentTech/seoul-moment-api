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

/** 배송 방법 */
export enum ShippingType {
  /** 택배 (주소지 배송) */
  HOME = 'HOME',
  /** 편의점 픽업 (ECPay 물류) */
  CVS = 'CVS',
}

/**
 * 편의점 체인. OK마트 C2C 는 2026-07-01 에 서비스가 끝나서 뺐다.
 * 실제 ECPay LogisticsSubType 은 ECPAY_LOGISTICS_TYPE 에 따라 UNIMARTC2C / UNIMART 처럼 갈린다.
 */
export enum CvsChain {
  /** 7-ELEVEN */
  UNIMART = 'UNIMART',
  /** 全家 FamilyMart */
  FAMI = 'FAMI',
  /** 萊爾富 Hi-Life */
  HILIFE = 'HILIFE',
}

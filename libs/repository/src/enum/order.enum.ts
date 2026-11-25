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

/**
 * 고객 주문조회 배송 6단계 (명세 v6 §4). 결제·취소·환불 상태와 독립이다.
 * 해외배송 중은 실제 국제운송이 시작된 때만, 대만 도착은 통관 완료와 다르다.
 */
export enum DeliveryStage {
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  PREPARING_ORDER = 'PREPARING_ORDER',
  INTERNATIONAL_SHIPPING = 'INTERNATIONAL_SHIPPING',
  ARRIVED_TAIWAN = 'ARRIVED_TAIWAN',
  LOCAL_DELIVERY = 'LOCAL_DELIVERY',
  DELIVERED = 'DELIVERED',
}

/** 한국 공급처 발주 여부. 해외배송 시작과 별개다 */
export enum PurchaseStatus {
  NOT_ORDERED = 'NOT_ORDERED',
  ORDERED = 'ORDERED',
}

/** ADMIN 24시간 타이머 표시 상태 (명세 v6 §9A.4). 저장하지 않고 조회 시 계산한다 */
export enum FulfillmentTimerState {
  /** 결제 확정 전이거나 취소·실패 — 타이머 시작 전 */
  NOT_PAID = 'NOT_PAID',
  /** 결제 후 0~21시간 */
  WAITING = 'WAITING',
  /** 21~24시간. 임박 표시만 한다 */
  SOON = 'SOON',
  /** 24시간 경과, 발주 가능 */
  READY = 'READY',
  ORDERED = 'ORDERED',
  /** 취소·계약해제 통지 접수 — 24시간과 무관하게 발주 차단 */
  CANCEL_REQUESTED = 'CANCEL_REQUESTED',
}

/** 고객 주문조회 필터. PENDING(결제 전) 주문은 어느 필터에도 안 나온다 */
export enum UserOrderListFilter {
  ALL = 'ALL',
  /** 입금 대기 + 결제 완료 후 배송 완료 전 */
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  /** 취소 + 결제 후 처리 실패(환불 예정) */
  CANCELED = 'CANCELED',
}

/** ADMIN 주문 목록 상태 칩 (명세 v6 §9A.3) */
export enum AdminOrderChip {
  ALL = 'ALL',
  WAITING = 'WAITING',
  READY = 'READY',
  CANCEL_REQUESTED = 'CANCEL_REQUESTED',
  ORDERED = 'ORDERED',
}

/** 통관 상태. 배송 단계와 독립이다 — 대만 도착 ≠ 통관 완료 ≠ 국내배송 시작 */
export enum CustomsStatus {
  WAITING = 'WAITING',
  IN_PROGRESS = 'IN_PROGRESS',
  HELD = 'HELD',
  CLEARED = 'CLEARED',
}

/** 주문 작업 이력 종류. 이력은 지우지 않고 쌓기만 한다 */
export enum OrderEventType {
  CANCEL_REQUESTED = 'CANCEL_REQUESTED',
  CANCEL_REQUEST_WITHDRAWN = 'CANCEL_REQUEST_WITHDRAWN',
  PURCHASED = 'PURCHASED',
  DELIVERY_STAGE_CHANGED = 'DELIVERY_STAGE_CHANGED',
  LOCAL_DELIVERY_UPDATED = 'LOCAL_DELIVERY_UPDATED',
  SHIPMENT_UPDATED = 'SHIPMENT_UPDATED',
}

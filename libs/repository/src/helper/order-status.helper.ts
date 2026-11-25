import { OrderEntity } from '../entity/order.entity';
import { DEFAULT_LANGUAGE, LanguageCode } from '../enum/language.enum';
import {
  DeliveryStage,
  FulfillmentTimerState,
  OrderStatus,
  PurchaseStatus,
} from '../enum/order.enum';

/** 결제 후 발주 가능까지 기다리는 시간 (명세 v6 §9A.4). 서버 시각 기준이다 */
export const FULFILLMENT_WAIT_MS = 24 * 60 * 60 * 1000;
/** 이 시간 안으로 남으면 SOON (임박) */
export const FULFILLMENT_SOON_MS = 3 * 60 * 60 * 1000;

type Labels = Record<LanguageCode, string>;

const DELIVERY_STAGE_LABEL: Record<DeliveryStage, Labels> = {
  [DeliveryStage.ORDER_CONFIRMED]: {
    [LanguageCode.KOREAN]: '주문 확인',
    [LanguageCode.ENGLISH]: 'Order confirmed',
    [LanguageCode.TAIWAN]: '訂單確認',
  },
  [DeliveryStage.PREPARING_ORDER]: {
    [LanguageCode.KOREAN]: '상품 준비 중',
    [LanguageCode.ENGLISH]: 'Preparing order',
    [LanguageCode.TAIWAN]: '商品準備中',
  },
  [DeliveryStage.INTERNATIONAL_SHIPPING]: {
    [LanguageCode.KOREAN]: '해외배송 중',
    [LanguageCode.ENGLISH]: 'International shipping',
    [LanguageCode.TAIWAN]: '海外運送中',
  },
  [DeliveryStage.ARRIVED_TAIWAN]: {
    [LanguageCode.KOREAN]: '대만 도착',
    [LanguageCode.ENGLISH]: 'Arrived in Taiwan',
    [LanguageCode.TAIWAN]: '商品已抵台',
  },
  [DeliveryStage.LOCAL_DELIVERY]: {
    [LanguageCode.KOREAN]: '대만 국내배송 중',
    [LanguageCode.ENGLISH]: 'Local delivery',
    [LanguageCode.TAIWAN]: '台灣配送中',
  },
  [DeliveryStage.DELIVERED]: {
    [LanguageCode.KOREAN]: '배송 완료',
    [LanguageCode.ENGLISH]: 'Delivered',
    [LanguageCode.TAIWAN]: '配送完成',
  },
};

const ORDER_STATUS_LABEL: Record<OrderStatus, Labels> = {
  [OrderStatus.PENDING]: {
    [LanguageCode.KOREAN]: '결제 대기',
    [LanguageCode.ENGLISH]: 'Awaiting payment',
    [LanguageCode.TAIWAN]: '待付款',
  },
  [OrderStatus.PAYMENT_WAITING]: {
    [LanguageCode.KOREAN]: '입금 대기',
    [LanguageCode.ENGLISH]: 'Awaiting deposit',
    [LanguageCode.TAIWAN]: '待繳費',
  },
  [OrderStatus.PAID]: {
    [LanguageCode.KOREAN]: '결제 완료',
    [LanguageCode.ENGLISH]: 'Paid',
    [LanguageCode.TAIWAN]: '已付款',
  },
  [OrderStatus.CANCELED]: {
    [LanguageCode.KOREAN]: '주문 취소',
    [LanguageCode.ENGLISH]: 'Canceled',
    [LanguageCode.TAIWAN]: '訂單已取消',
  },
  [OrderStatus.FAILED]: {
    [LanguageCode.KOREAN]: '결제 후 처리 실패 (환불 예정)',
    [LanguageCode.ENGLISH]: 'Failed (refund pending)',
    [LanguageCode.TAIWAN]: '處理失敗（待退款）',
  },
};

const TIMER_STATE_LABEL: Record<FulfillmentTimerState, Labels> = {
  [FulfillmentTimerState.NOT_PAID]: {
    [LanguageCode.KOREAN]: '결제 대기',
    [LanguageCode.ENGLISH]: 'Awaiting payment',
    [LanguageCode.TAIWAN]: '待付款',
  },
  [FulfillmentTimerState.WAITING]: {
    [LanguageCode.KOREAN]: '24시간 대기 중',
    [LanguageCode.ENGLISH]: 'Waiting 24h',
    [LanguageCode.TAIWAN]: '24小時等待中',
  },
  [FulfillmentTimerState.SOON]: {
    [LanguageCode.KOREAN]: '곧 발주 가능',
    [LanguageCode.ENGLISH]: 'Ready soon',
    [LanguageCode.TAIWAN]: '即將可下單',
  },
  [FulfillmentTimerState.READY]: {
    [LanguageCode.KOREAN]: '24시간 경과 · 발주 가능',
    [LanguageCode.ENGLISH]: '24h passed · ready to order',
    [LanguageCode.TAIWAN]: '已滿24小時・可下單',
  },
  [FulfillmentTimerState.ORDERED]: {
    [LanguageCode.KOREAN]: '발주 완료',
    [LanguageCode.ENGLISH]: 'Ordered',
    [LanguageCode.TAIWAN]: '已下單',
  },
  [FulfillmentTimerState.CANCEL_REQUESTED]: {
    [LanguageCode.KOREAN]: '취소/철회 접수',
    [LanguageCode.ENGLISH]: 'Cancellation requested',
    [LanguageCode.TAIWAN]: '已受理取消/解約',
  },
};

/** 모르는 언어는 한국어로 돌린다 (Accept-Language 가 비어도 응답은 나가야 한다) */
function pick(labels: Labels, language?: LanguageCode): string {
  return labels[language] ?? labels[DEFAULT_LANGUAGE];
}

export function getDeliveryStageLabel(
  stage: DeliveryStage,
  language?: LanguageCode,
): string {
  return pick(DELIVERY_STAGE_LABEL[stage], language);
}

/** 진행바 위치 (1~6) */
export function getDeliveryStep(stage: DeliveryStage): number {
  return Object.values(DeliveryStage).indexOf(stage) + 1;
}

export function getOrderStatusLabel(
  status: OrderStatus,
  language?: LanguageCode,
): string {
  return pick(ORDER_STATUS_LABEL[status], language);
}

export function getTimerStateLabel(
  state: FulfillmentTimerState,
  language?: LanguageCode,
): string {
  return pick(TIMER_STATE_LABEL[state], language);
}

type TimerSource = Pick<
  OrderEntity,
  'status' | 'paidAt' | 'purchaseStatus' | 'cancellationRequestedAt'
>;

export function getReadyAt(paidAt: Date | null): Date | null {
  return paidAt ? new Date(paidAt.getTime() + FULFILLMENT_WAIT_MS) : null;
}

/** 결제 완료 전에는 타이머가 시작되지 않는다. 클라이언트 시각은 쓰지 않는다 */
export function getTimerState(
  order: TimerSource,
  now: Date,
): FulfillmentTimerState {
  if (order.status !== OrderStatus.PAID || !order.paidAt) {
    return FulfillmentTimerState.NOT_PAID;
  }

  if (order.purchaseStatus === PurchaseStatus.ORDERED) {
    return FulfillmentTimerState.ORDERED;
  }

  if (order.cancellationRequestedAt) {
    return FulfillmentTimerState.CANCEL_REQUESTED;
  }

  const remaining = getReadyAt(order.paidAt).getTime() - now.getTime();

  if (remaining <= 0) {
    return FulfillmentTimerState.READY;
  }

  return remaining <= FULFILLMENT_SOON_MS
    ? FulfillmentTimerState.SOON
    : FulfillmentTimerState.WAITING;
}

/**
 * 결제 완료 주문이면 발주·해외배송·수령 여부와 무관하게 취소·계약해제를 접수한다
 * (명세 v6 §7.2 — 24시간 경과나 발주만으로 법정 권리를 막지 않는다).
 */
export function canRequestCancel(
  order: Pick<OrderEntity, 'status' | 'cancellationRequestedAt'>,
): boolean {
  return order.status === OrderStatus.PAID && !order.cancellationRequestedAt;
}

/**
 * 고객이 취소를 접수하면 관리자 확인 없이 바로 환불하는 주문인지 (환불 규정 1).
 * 결제 후 24시간 안이고 아직 한국에 발주하지 않은 주문만이다. 그 밖은 관리자가 확인한다.
 * 발주 기록 없이 배송 단계만 옮긴 주문도 이미 움직인 것으로 본다.
 */
export function canAutoRefund(
  order: Pick<
    OrderEntity,
    | 'status'
    | 'paidAt'
    | 'purchaseStatus'
    | 'deliveryStage'
    | 'cancellationRequestedAt'
  >,
  now: Date,
): boolean {
  return (
    !!order.cancellationRequestedAt &&
    order.purchaseStatus === PurchaseStatus.NOT_ORDERED &&
    order.deliveryStage === DeliveryStage.ORDER_CONFIRMED &&
    isQuickCancelPeriod(order, now)
  );
}

/** 24시간 간편취소 구간인지. 안내 문구만 바꾸는 값이고 신청 가능 여부와는 별개다 */
export function isQuickCancelPeriod(
  order: Pick<OrderEntity, 'status' | 'paidAt'>,
  now: Date,
): boolean {
  return (
    order.status === OrderStatus.PAID &&
    !!order.paidAt &&
    now.getTime() < getReadyAt(order.paidAt).getTime()
  );
}

export function getRemainingSeconds(
  order: Pick<OrderEntity, 'paidAt'>,
  now: Date,
): number {
  const readyAt = getReadyAt(order.paidAt);

  return readyAt
    ? Math.max(0, Math.ceil((readyAt.getTime() - now.getTime()) / 1000))
    : 0;
}

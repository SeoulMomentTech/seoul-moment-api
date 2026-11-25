import { OrderEventEntity } from '@app/repository/entity/order-event.entity';
import { OrderEntity } from '@app/repository/entity/order.entity';
import { PaymentEntity } from '@app/repository/entity/payment.entity';
import { RefundEntity } from '@app/repository/entity/refund.entity';
import { ShipmentEntity } from '@app/repository/entity/shipment.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  AdminOrderChip,
  DeliveryStage,
  FulfillmentTimerState,
  OrderEventType,
  PaymentMethod,
  PurchaseStatus,
} from '@app/repository/enum/order.enum';
import {
  getDeliveryStageLabel,
  getDeliveryStep,
  getReadyAt,
  getRemainingSeconds,
  getTimerState,
  getTimerStateLabel,
} from '@app/repository/helper/order-status.helper';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, plainToInstance } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { GetUserOrderResponse } from '../../user/order/user.order.dto';
import { ListFilterDto } from '../admin.dto';
import {
  GetAdminInvoiceAdjustmentResponse,
  GetAdminRefundResponse,
} from './admin.refund.dto';
import { GetAdminShipmentInfoResponse } from './admin.shipment.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class GetAdminOrderListRequest extends ListFilterDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  declare page?: number;

  @ApiPropertyOptional({ description: '페이지 크기 (최대 100)', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  declare count?: number;

  @ApiPropertyOptional({
    description:
      'ALL 전체 / WAITING 24시간 대기 중 / READY 발주 가능 / CANCEL_REQUESTED 취소 요청 / ORDERED 발주 완료. search 는 주문번호·받는 분·상품명',
    enum: AdminOrderChip,
    default: AdminOrderChip.ALL,
  })
  @IsOptional()
  @IsEnum(AdminOrderChip)
  chip: AdminOrderChip = AdminOrderChip.ALL;

  @ApiPropertyOptional({
    description: '결제일 시작 (Asia/Taipei 날짜, 포함)',
    example: '2026-11-01',
  })
  @IsOptional()
  @Matches(DATE_PATTERN)
  paidFrom?: string;

  @ApiPropertyOptional({
    description: '결제일 끝 (Asia/Taipei 날짜, 포함)',
    example: '2026-11-30',
  })
  @IsOptional()
  @Matches(DATE_PATTERN)
  paidTo?: string;

  @ApiPropertyOptional({ description: '배송 단계', enum: DeliveryStage })
  @IsOptional()
  @IsEnum(DeliveryStage)
  deliveryStage?: DeliveryStage;
}

export class GetAdminOrderSummaryResponse {
  @ApiProperty({
    description:
      '오늘 신규 주문: paid_at 이 오늘(Asia/Taipei) 인 결제 완료 건수',
    example: 12,
  })
  todayNew: number;

  @ApiProperty({
    description: '24시간 대기 중: 결제 완료·미발주·취소 미접수·24시간 미경과',
    example: 7,
  })
  waiting: number;

  @ApiProperty({
    description: '발주 가능: 결제 완료·미발주·취소 미접수·24시간 경과',
    example: 4,
  })
  ready: number;

  @ApiProperty({
    description: '취소 요청: 취소·계약해제 통지가 접수된 결제 완료 건수',
    example: 1,
  })
  cancelRequested: number;

  @ApiProperty({
    description: '집계 기준 시각(서버). KPI 는 겹칠 수 있어 합산하지 않는다',
  })
  asOf: Date;

  static from(
    counts: Pick<
      GetAdminOrderSummaryResponse,
      'todayNew' | 'waiting' | 'ready' | 'cancelRequested'
    >,
    asOf: Date,
  ) {
    return plainToInstance(this, { ...counts, asOf });
  }
}

export class GetAdminOrderListItemResponse {
  @ApiProperty({ example: 481 })
  orderId: number;

  @ApiProperty({ example: 'SM-20260903-000481' })
  orderNumber: string;

  @ApiPropertyOptional({ description: '결제 완료 시각', nullable: true })
  paidAt: Date | null;

  @ApiPropertyOptional({ description: '받는 분 (고객명)', nullable: true })
  recipientName: string | null;

  @ApiProperty({ description: '실제 결제 금액 NT$', example: 3880 })
  totalAmount: number;

  @ApiProperty({ enum: PaymentMethod, nullable: true })
  paymentMethod: PaymentMethod | null;

  @ApiProperty({
    description:
      '24시간 타이머 상태. 행 색은 이 값으로 정한다 (WAITING 흰색/연한 파랑, SOON 연한 주황, READY 연한 초록, CANCEL_REQUESTED 연한 분홍)',
    enum: FulfillmentTimerState,
  })
  timerState: FulfillmentTimerState;

  @ApiProperty({ example: '24시간 대기 중' })
  timerStateLabel: string;

  @ApiProperty({
    description: '발주 가능까지 남은 초 (서버 기준, 0이면 경과)',
    example: 3600,
  })
  remainingSeconds: number;

  @ApiPropertyOptional({ description: '발주 가능 시각', nullable: true })
  readyAt: Date | null;

  @ApiProperty({ enum: PurchaseStatus })
  purchaseStatus: PurchaseStatus;

  @ApiPropertyOptional({ nullable: true })
  supplierOrderedAt: Date | null;

  @ApiProperty({ description: '취소·계약해제 통지 접수 여부' })
  cancellationRequested: boolean;

  @ApiProperty({ enum: DeliveryStage })
  deliveryStage: DeliveryStage;

  @ApiProperty({ example: '상품 준비 중' })
  deliveryStageLabel: string;

  @ApiProperty({
    description:
      '`한국 발주 시작` 버튼 활성 여부. 정상 발주(24시간 경과) 기준이다',
  })
  canStartPurchase: boolean;

  static from(order: OrderEntity, now: Date, language?: LanguageCode) {
    const timerState = getTimerState(order, now);

    return plainToInstance(this, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paidAt: order.paidAt ?? null,
      recipientName: order.shipping?.recipientName ?? null,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod ?? null,
      timerState,
      timerStateLabel: getTimerStateLabel(timerState, language),
      remainingSeconds: getRemainingSeconds(order, now),
      readyAt: getReadyAt(order.paidAt ?? null),
      purchaseStatus: order.purchaseStatus,
      supplierOrderedAt: order.supplierOrderedAt ?? null,
      cancellationRequested: !!order.cancellationRequestedAt,
      deliveryStage: order.deliveryStage,
      deliveryStageLabel: getDeliveryStageLabel(order.deliveryStage, language),
      canStartPurchase: timerState === FulfillmentTimerState.READY,
    });
  }
}

export class GetAdminOrderPurchaseResponse {
  @ApiProperty({ enum: PurchaseStatus })
  purchaseStatus: PurchaseStatus;

  @ApiPropertyOptional({ nullable: true })
  supplierOrderedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  supplierOrderNo: string | null;

  @ApiPropertyOptional({
    description: '24시간 전에 조기 발주한 사유. 정상 발주면 null',
    nullable: true,
  })
  purchaseOverrideReason: string | null;

  @ApiPropertyOptional({ description: '발주 처리한 관리자 ID', nullable: true })
  purchasedByAdminId: number | null;
}

export class GetAdminOrderDeliveryResponse {
  @ApiProperty({ enum: DeliveryStage })
  deliveryStage: DeliveryStage;

  @ApiProperty({ example: '해외배송 중' })
  deliveryStageLabel: string;

  @ApiProperty({ description: '진행바 위치 (1~6)', example: 3 })
  deliveryStep: number;

  @ApiPropertyOptional({
    description: '실제 수령·배송 완료 시각. 법정 기간 계산의 기준이다',
    nullable: true,
  })
  deliveredAt: Date | null;

  @ApiPropertyOptional({ description: '대만 국내운송사', nullable: true })
  localCarrier: string | null;

  @ApiPropertyOptional({ description: '대만 국내운송장', nullable: true })
  localTrackingNo: string | null;

  @ApiProperty({
    description:
      '이 주문이 실린 국제배송 묶음 (국제운송장·수입신고번호·통관 상태). 없으면 빈 배열',
    type: [GetAdminShipmentInfoResponse],
  })
  shipments: GetAdminShipmentInfoResponse[];
}

export class GetAdminOrderCancellationResponse {
  @ApiPropertyOptional({
    description: '취소·계약해제 통지를 접수한 시각. 접수 전이면 null',
    nullable: true,
  })
  requestedAt: Date | null;

  @ApiPropertyOptional({ description: '고객이 적은 사유', nullable: true })
  reason: string | null;

  @ApiPropertyOptional({
    description:
      '결제 후 24시간 안에 접수됐는지(간편취소 구간). 접수 전이면 null. false 여도 법정 계약해제 통지로 처리해야 한다',
    nullable: true,
  })
  withinQuickCancelPeriod: boolean | null;
}

export class GetAdminOrderEventResponse {
  @ApiProperty({ example: 31 })
  eventId: number;

  @ApiProperty({ enum: OrderEventType })
  type: OrderEventType;

  @ApiPropertyOptional({ description: '처리한 관리자 ID', nullable: true })
  adminId: number | null;

  @ApiPropertyOptional({ description: '요청한 고객 ID', nullable: true })
  userId: number | null;

  @ApiPropertyOptional({
    description: '무엇이 어떻게 바뀌었는지',
    example: 'PREPARING_ORDER → INTERNATIONAL_SHIPPING',
    nullable: true,
  })
  message: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class GetAdminOrderDetailResponse {
  @ApiProperty({
    description:
      '고객 주문조회 상세와 같은 내용 (상품·가격내역·배송지·결제·발표). 가격내역에 internationalDiscount 포함',
    type: GetUserOrderResponse,
  })
  order: GetUserOrderResponse;

  @ApiProperty({
    description: '발주·매입',
    type: GetAdminOrderPurchaseResponse,
  })
  purchase: GetAdminOrderPurchaseResponse;

  @ApiProperty({
    description: '24시간 타이머',
    type: GetAdminOrderListItemResponse,
  })
  timer: GetAdminOrderListItemResponse;

  @ApiProperty({
    description: '통관·배송 탭',
    type: GetAdminOrderDeliveryResponse,
  })
  delivery: GetAdminOrderDeliveryResponse;

  @ApiProperty({
    description: '취소·환불 탭 중 취소 접수',
    type: GetAdminOrderCancellationResponse,
  })
  cancellation: GetAdminOrderCancellationResponse;

  @ApiProperty({
    description: '작업 이력 탭 (최신순)',
    type: [GetAdminOrderEventResponse],
  })
  events: GetAdminOrderEventResponse[];

  @ApiPropertyOptional({
    description: '취소·환불 탭 중 환불. 환불을 시작하지 않았으면 null',
    type: GetAdminRefundResponse,
    nullable: true,
  })
  refund: GetAdminRefundResponse | null;

  @ApiPropertyOptional({
    description:
      '전자발표 정정(作廢·折讓). 환불 결과와 따로 본다. 발표 행이 없는 주문이면 null',
    type: GetAdminInvoiceAdjustmentResponse,
    nullable: true,
  })
  invoiceAdjustment: GetAdminInvoiceAdjustmentResponse | null;

  static from(
    order: OrderEntity,
    payment: PaymentEntity | null,
    now: Date,
    language?: LanguageCode,
    extra: {
      shipments?: ShipmentEntity[];
      events?: OrderEventEntity[];
      refund?: RefundEntity | null;
    } = {},
  ) {
    const { shipments = [], events = [], refund = null } = extra;

    return plainToInstance(this, {
      delivery: this.toDelivery(order, shipments, language),
      cancellation: this.toCancellation(order),
      refund: refund ? GetAdminRefundResponse.toPlain(refund) : null,
      invoiceAdjustment: order.invoice
        ? GetAdminInvoiceAdjustmentResponse.toPlain(order.invoice)
        : null,
      events: events.map((event) => ({
        eventId: event.id,
        type: event.type,
        adminId: event.adminId ?? null,
        userId: event.userId ?? null,
        message: event.message ?? null,
        createdAt: event.createDate,
      })),
      order: GetUserOrderResponse.from(order, payment, language, refund),
      purchase: {
        purchaseStatus: order.purchaseStatus,
        supplierOrderedAt: order.supplierOrderedAt ?? null,
        supplierOrderNo: order.supplierOrderNo ?? null,
        purchaseOverrideReason: order.purchaseOverrideReason ?? null,
        purchasedByAdminId: order.purchasedByAdminId ?? null,
      },
      timer: GetAdminOrderListItemResponse.from(order, now, language),
    });
  }

  private static toDelivery(
    order: OrderEntity,
    shipments: ShipmentEntity[],
    language?: LanguageCode,
  ) {
    return {
      deliveryStage: order.deliveryStage,
      deliveryStageLabel: getDeliveryStageLabel(order.deliveryStage, language),
      deliveryStep: getDeliveryStep(order.deliveryStage),
      deliveredAt: order.deliveredAt ?? null,
      localCarrier: order.localCarrier ?? null,
      localTrackingNo: order.localTrackingNo ?? null,
      shipments: shipments.map((shipment) =>
        GetAdminShipmentInfoResponse.toInfo(shipment),
      ),
    };
  }

  private static toCancellation(order: OrderEntity) {
    const requestedAt = order.cancellationRequestedAt ?? null;

    return {
      requestedAt,
      reason: order.cancellationReason ?? null,
      withinQuickCancelPeriod:
        requestedAt && order.paidAt
          ? requestedAt.getTime() < getReadyAt(order.paidAt).getTime()
          : null,
    };
  }
}

export class PostAdminOrderPurchaseRequest {
  @ApiPropertyOptional({
    description: '공급처 발주번호. 공급처 API 가 없으면 관리자가 입력한다',
    example: 'KR-20261123-0042',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  supplierOrderNo?: string;

  @ApiPropertyOptional({
    description:
      '24시간이 지나기 전(조기 발주)이면 필수. 사유가 주문에 기록된다',
    example: '재고 소진 임박으로 선발주',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  earlyReason?: string;
}

export class PostAdminOrderDeliveryStageRequest {
  @ApiProperty({
    description:
      '단계를 바꿀 주문 ID (1~100개). 한 건만 바꿀 때도 배열로 보낸다. 하나라도 없거나 결제 완료가 아니면 전부 바뀌지 않는다',
    example: [481, 482],
    type: [Number],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  orderIds: number[];

  @ApiProperty({
    description:
      '바꿀 배송 단계. 앞·뒤 어느 쪽으로든 바꿀 수 있고 이력에 남는다. 통관 상태와는 따로다',
    enum: DeliveryStage,
  })
  @IsEnum(DeliveryStage)
  deliveryStage: DeliveryStage;

  @ApiPropertyOptional({
    description:
      'DELIVERED 일 때 실제 수령·배송 완료 시각 (ISO 8601). 생략하면 지금. 미래 시각·다른 단계와 함께 보내면 400',
    example: '2026-11-25T06:30:00Z',
  })
  @IsOptional()
  @IsISO8601()
  deliveredAt?: string;
}

export class PatchAdminOrderLocalDeliveryRequest {
  @ApiPropertyOptional({
    description: '대만 국내운송사. 빈 문자열·null 이면 지운다',
    example: '7-ELEVEN',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  localCarrier?: string | null;

  @ApiPropertyOptional({
    description: '대만 국내운송장 번호. 빈 문자열·null 이면 지운다',
    example: 'D1234567890',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  localTrackingNo?: string | null;
}

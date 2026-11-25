import { OrderItemEntity } from '@app/repository/entity/order-item.entity';
import { OrderEntity } from '@app/repository/entity/order.entity';
import { PaymentEntity } from '@app/repository/entity/payment.entity';
import { RefundEntity } from '@app/repository/entity/refund.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  DeliveryStage,
  OrderStatus,
  PaymentMethod,
  ShippingType,
  UserOrderListFilter,
} from '@app/repository/enum/order.enum';
import { RefundStatus } from '@app/repository/enum/refund.enum';
import {
  canRequestCancel,
  getDeliveryStageLabel,
  getDeliveryStep,
  getOrderStatusLabel,
  getReadyAt,
  isQuickCancelPeriod,
} from '@app/repository/helper/order-status.helper';
import { getRefundedAmount } from '@app/repository/helper/refund.helper';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, plainToInstance } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import {
  GetOrderInvoiceResponse,
  UserOrderInvoiceRequest,
} from '../../invoice/invoice.dto';
import { GetOrderPaymentResponse } from '../../payment/payment.dto';
import { CartAmountDto } from '../cart/cart.calculator';
import {
  GetUserCartBrandGroupResponse,
  MAX_CART_QUANTITY,
} from '../cart/user.cart.dto';

/** 한 주문에 담을 수 있는 라인 수 상한 */
export const MAX_ORDER_LINE = 100;

export class UserOrderShippingRequest {
  @ApiProperty({ description: '받는 분', example: '李佳蓉' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  recipientName: string;

  @ApiProperty({ description: '연락처', example: '+886 912 345 678' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  phone: string;

  @ApiProperty({ description: '우편번호', example: '110' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  postalCode: string;

  @ApiProperty({ description: '縣市', example: '臺北市' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  city: string;

  @ApiProperty({ description: '區/鄉', example: '信義區' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  district: string;

  @ApiProperty({ description: '상세 주소', example: '松高路 11號 5樓' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  detailAddress: string;

  @ApiPropertyOptional({
    description: '배송 요청사항',
    example: '부재 시 경비실에 맡겨주세요',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  requestMessage?: string;
}

/**
 * 편의점 수령인. 편의점은 이름을 신분증과 대조하고 문자로 도착을 알린다.
 * ECPay 규칙: 중문 2–5자 또는 영문 4–10자(숫자·특수문자·공백 불가), 휴대폰 09 로 시작하는 10자리.
 */
export const CVS_RECIPIENT_NAME_PATTERN = /^([一-鿿]{2,5}|[A-Za-z]{4,10})$/;
export const CVS_PHONE_PATTERN = /^09\d{8}$/;

export class UserOrderCvsPickupRequest {
  @ApiProperty({
    description:
      '전자지도에서 매장을 고른 뒤 받은 cvsStoreToken (GET /logistics/cvs/map). 1시간 유효',
    example: '3f9c1a7b2e4d6f8a0b1c',
  })
  @IsString()
  @IsNotEmpty()
  storeToken: string;

  @ApiProperty({
    description:
      '받는 분 실명 — 수령 시 신분증과 대조한다. 중문 2–5자 또는 영문 4–10자(공백·숫자 불가)',
    example: '李佳蓉',
  })
  @IsString()
  @Matches(CVS_RECIPIENT_NAME_PATTERN, {
    message:
      'recipientName must be 2–5 Chinese characters or 4–10 English letters',
  })
  recipientName: string;

  @ApiProperty({
    description: '받는 분 휴대폰 (09 로 시작하는 10자리). 도착 문자가 간다',
    example: '0912345678',
  })
  @IsString()
  @Matches(CVS_PHONE_PATTERN, { message: 'phone must be 09 + 8 digits' })
  phone: string;
}

export class UserOrderDirectItemRequest {
  @ApiProperty({
    description: '상품 변형(SKU) ID. 상품상세 v1 응답의 variants[].id',
    example: 101,
  })
  @IsInt()
  @IsPositive()
  @IsDefined()
  productVariantId: number;

  @ApiProperty({ description: '수량', example: 1 })
  @IsInt()
  @IsPositive()
  @Max(MAX_CART_QUANTITY)
  @IsDefined()
  quantity: number;
}

/**
 * 주문 라인을 어디서 가져올지. 장바구니에서 주문하면 cartItemIds,
 * 상품상세 "구매하기" 면 items 를 보낸다. 둘 중 정확히 하나만 보내야 한다.
 */
export class UserOrderLineSourceRequest {
  @ApiPropertyOptional({
    description:
      '장바구니에서 주문할 때 — 주문할 장바구니 라인 ID 목록. items 와 함께 보낼 수 없다',
    example: [1, 2],
    type: [Number],
  })
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ORDER_LINE)
  @IsOptional()
  cartItemIds?: number[];

  @ApiPropertyOptional({
    description:
      '상품상세 "구매하기" 일 때 — 장바구니를 거치지 않고 SKU·수량을 바로 넘긴다. ' +
      '장바구니에 담긴 수량과 합산하지 않는다. 같은 SKU 가 여러 줄이면 수량을 합친다. ' +
      'cartItemIds 와 함께 보낼 수 없다',
    type: [UserOrderDirectItemRequest],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ORDER_LINE)
  @ValidateNested({ each: true })
  @Type(() => UserOrderDirectItemRequest)
  @IsOptional()
  items?: UserOrderDirectItemRequest[];
}

export class PostUserOrderPreviewRequest extends UserOrderLineSourceRequest {
  @ApiPropertyOptional({
    description:
      '배송지 縣市. 생략하면 본섬 기준 예상 배송비를 내려준다 (isShippingEstimated=true)',
    example: '臺北市',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({
    description:
      '배송지 區/鄉. 綠島鄉·蘭嶼鄉 은 臺東縣이지만 외섬이다. 생략하면 예상 배송비다',
    example: '信義區',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @IsOptional()
  district?: string;

  @ApiPropertyOptional({
    description:
      '배송 방법. CVS(편의점 픽업)면 city·district 대신 cvsStoreToken 으로 배송비를 정한다 (離島 매장이면 외섬 요금)',
    enum: ShippingType,
    example: ShippingType.HOME,
  })
  @IsEnum(ShippingType)
  @IsOptional()
  shippingType?: ShippingType;

  @ApiPropertyOptional({
    description:
      'CVS 일 때 고른 매장의 cvsStoreToken. 생략하면 본섬 기준 예상 배송비다',
    example: '3f9c1a7b2e4d6f8a0b1c',
  })
  @IsString()
  @IsOptional()
  cvsStoreToken?: string;
}

export class PostUserOrderRequest extends UserOrderLineSourceRequest {
  @ApiProperty({
    description: '결제 수단',
    enum: PaymentMethod,
    example: PaymentMethod.LINE_PAY,
  })
  @IsEnum(PaymentMethod)
  @IsDefined()
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({
    description:
      '배송 방법. 생략하면 HOME(택배). CVS 면 cvsPickup 이 필수이고 useDefaultShipping·shipping 은 보지 않는다',
    enum: ShippingType,
    example: ShippingType.HOME,
  })
  @IsEnum(ShippingType)
  @IsOptional()
  shippingType?: ShippingType;

  @ApiPropertyOptional({
    description:
      'HOME 일 때 필수. true 면 user_profile 과 user.phone 을 배송지로 쓴다',
    example: true,
  })
  @ValidateIf((o: PostUserOrderRequest) => o.shippingType !== ShippingType.CVS)
  @IsBoolean()
  @IsDefined()
  useDefaultShipping?: boolean;

  @ApiPropertyOptional({
    description: 'HOME 이고 useDefaultShipping 이 false 일 때 필수',
    type: UserOrderShippingRequest,
  })
  @ValidateNested()
  @Type(() => UserOrderShippingRequest)
  @IsOptional()
  shipping?: UserOrderShippingRequest;

  @ApiPropertyOptional({
    description: 'CVS(편의점 픽업)일 때 필수',
    type: UserOrderCvsPickupRequest,
  })
  @ValidateIf((o: PostUserOrderRequest) => o.shippingType === ShippingType.CVS)
  @IsDefined()
  @ValidateNested()
  @Type(() => UserOrderCvsPickupRequest)
  cvsPickup?: UserOrderCvsPickupRequest;

  @ApiPropertyOptional({
    description:
      '전자발표(電子發票) 받는 방법. 생략하면 ECPay 회원 載具(MEMBER_CARRIER, 회원 이메일로 받음). 결제가 확정되면 서버가 발행한다',
    type: UserOrderInvoiceRequest,
  })
  @ValidateNested()
  @Type(() => UserOrderInvoiceRequest)
  @IsOptional()
  invoice?: UserOrderInvoiceRequest;
}

export class PostUserOrderPreviewResponse {
  @ApiProperty({
    description: '브랜드별 묶음 (표시용)',
    type: [GetUserCartBrandGroupResponse],
  })
  brandGroups: GetUserCartBrandGroupResponse[];

  @ApiProperty({ description: '상품 금액 합', example: 900 })
  totalProductAmount: number;

  @ApiProperty({
    description:
      '배송비. 배송지 지역과 무료배송 판정이 반영된 값. isShippingEstimated 가 true 면 본섬 기준 예상값',
    example: 60,
  })
  shippingFee: number;

  @ApiProperty({ description: '외섬 여부', example: false })
  isRemoteIsland: boolean;

  @ApiProperty({
    description:
      '배송비가 예상값인지. city·district 를 생략하면 true 이고 본섬 기준으로 계산된다',
    example: false,
  })
  isShippingEstimated: boolean;

  @ApiProperty({ description: '무료배송 임계금액', example: 1150 })
  freeShippingThreshold: number;

  @ApiProperty({ description: '무료배송까지 남은 금액', example: 250 })
  amountToFreeShipping: number;

  @ApiProperty({
    description:
      '국제배송비 지원 할인액(NT$). 상품 합계에서 1회 차감된다. 기능이 꺼져 있으면 0',
    example: 120,
  })
  internationalDiscount: number;

  @ApiPropertyOptional({
    description:
      '다음 할인 구간의 상품 합계 기준 NT$. 기능이 꺼져 있거나 마지막 구간이면 null',
    nullable: true,
    example: 5000,
  })
  nextDiscountThreshold: number | null;

  @ApiPropertyOptional({
    description: '다음 구간에서 받는 할인액 NT$. 없으면 null',
    nullable: true,
    example: 250,
  })
  nextDiscountAmount: number | null;

  @ApiProperty({
    description: '다음 할인 구간까지 남은 금액 NT$. 다음 구간이 없으면 0',
    example: 1360,
  })
  amountToNextDiscount: number;

  @ApiProperty({ description: '최종 결제 금액', example: 960 })
  totalAmount: number;

  static from(
    groups: GetUserCartBrandGroupResponse[],
    amount: CartAmountDto,
    isShippingEstimated: boolean,
  ): PostUserOrderPreviewResponse {
    return plainToInstance(this, {
      brandGroups: groups,
      totalProductAmount: amount.totalProductAmount,
      shippingFee: amount.shippingFee,
      isRemoteIsland: amount.isRemoteIsland,
      isShippingEstimated,
      freeShippingThreshold: amount.freeShippingThreshold,
      amountToFreeShipping: amount.amountToFreeShipping,
      internationalDiscount: amount.internationalDiscount,
      nextDiscountThreshold: amount.nextDiscountThreshold,
      nextDiscountAmount: amount.nextDiscountAmount,
      amountToNextDiscount: amount.amountToNextDiscount,
      totalAmount: amount.totalAmount,
    });
  }
}

export class PostUserOrderResponse {
  @ApiProperty({ description: '주문 ID', example: 481 })
  orderId: number;

  @ApiProperty({ description: '주문번호', example: 'SM-20260903-000481' })
  orderNumber: string;

  @ApiProperty({ description: '최종 결제 금액', example: 960 })
  totalAmount: number;

  static from(orderId: number, orderNumber: string, totalAmount: number) {
    return plainToInstance(this, { orderId, orderNumber, totalAmount });
  }
}

export class GetUserOrderItemResponse {
  @ApiProperty({ description: '주문 라인 ID', example: 1 })
  orderItemId: number;

  @ApiProperty({ description: '상품 아이템 ID', example: 10 })
  productItemId: number;

  @ApiProperty({ description: '브랜드 ID', example: 1 })
  brandId: number;

  @ApiProperty({ description: '주문 시점 브랜드명', example: '온도' })
  brandName: string;

  @ApiProperty({
    description: '주문 시점 상품명',
    example: '코튼 트윌 오버셔츠',
  })
  productName: string;

  @ApiProperty({ description: '옵션 조합', example: 'IVORY / M' })
  optionText: string;

  @ApiProperty({
    description: '주문 시점 이미지 URL',
    example: 'https://example.com/image.png',
  })
  imageUrl: string;

  @ApiProperty({ description: '정가', example: 1400 })
  unitPrice: number;

  @ApiProperty({ description: '적용가', example: 1280 })
  unitDiscountPrice: number;

  @ApiProperty({ description: '수량', example: 2 })
  quantity: number;

  @ApiProperty({ description: '라인 금액', example: 2560 })
  totalPrice: number;

  static from(entity: OrderItemEntity) {
    return plainToInstance(this, {
      orderItemId: entity.id,
      productItemId: entity.productItemId,
      brandId: entity.brandId,
      brandName: entity.brandNameSnapshot,
      productName: entity.productNameSnapshot,
      optionText: entity.optionTextSnapshot,
      imageUrl: entity.imageUrlSnapshot,
      unitPrice: entity.unitPrice,
      unitDiscountPrice: entity.unitDiscountPrice,
      quantity: entity.quantity,
      totalPrice: entity.totalPrice,
    });
  }
}

export class GetUserOrderShippingResponse {
  @ApiProperty({
    description: '배송 방법',
    enum: ShippingType,
    example: ShippingType.HOME,
  })
  shippingType: ShippingType;

  @ApiProperty({ description: '받는 분', example: '李佳蓉' })
  recipientName: string;

  @ApiProperty({ description: '연락처', example: '+886 912 345 678' })
  phone: string;

  @ApiProperty({ description: '우편번호', example: '110' })
  postalCode: string;

  @ApiProperty({ description: '縣市', example: '臺北市' })
  city: string;

  @ApiProperty({ description: '區/鄉', example: '信義區' })
  district: string;

  @ApiProperty({ description: '상세 주소', example: '松高路 11號 5樓' })
  detailAddress: string;

  @ApiPropertyOptional({ description: '배송 요청사항', example: null })
  requestMessage?: string;

  @ApiPropertyOptional({
    description: '편의점 픽업 매장 (CVS 일 때만). 주소 필드는 null 이다',
    nullable: true,
    example: {
      logisticsSubType: 'UNIMARTC2C',
      storeId: '131386',
      storeName: '建盛門市',
      storeAddress: '台北市中正區重慶南路一段122號',
      storeTelephone: null,
      isOutsideIsland: false,
    },
  })
  cvsStore?: {
    logisticsSubType: string;
    storeId: string;
    storeName: string;
    storeAddress: string;
    storeTelephone: string | null;
    isOutsideIsland: boolean;
  } | null;
}

export class GetUserOrderRefundResponse {
  @ApiProperty({
    description:
      'REQUESTED·PROCESSING 환불 진행 중 / COMPLETED 환불 완료 / FAILED 환불 처리 지연 (고객센터 확인 중)',
    enum: RefundStatus,
  })
  status: RefundStatus;

  @ApiProperty({
    description: '이 환불의 금액 NT$. 결제 금액보다 작으면 부분 환불이다',
    example: 3880,
  })
  amount: number;

  @ApiProperty({ description: '환불 접수 시각' })
  requestedAt: Date;

  @ApiPropertyOptional({
    description:
      '환불 완료 시각. 카드 명세서 반영은 카드사에 따라 더 걸릴 수 있다',
    nullable: true,
  })
  completedAt: Date | null;
}

export class GetUserOrderResponse {
  @ApiProperty({ description: '주문 ID', example: 481 })
  orderId: number;

  @ApiProperty({ description: '주문번호', example: 'SM-20260903-000481' })
  orderNumber: string;

  @ApiProperty({
    description:
      '주문 상태. PENDING 결제 전(결제창 이탈 포함, 다시 결제 가능) / PAYMENT_WAITING ATM·편의점 입금 대기 / PAID 결제 완료 / CANCELED 취소(입금 기한 경과·장기 미결제·환불 완료) / FAILED 결제 후 재고 부족 등으로 환불 대상',
    example: 'PENDING',
  })
  status: string;

  @ApiPropertyOptional({
    description: '결제 수단',
    enum: PaymentMethod,
    example: PaymentMethod.LINE_PAY,
  })
  paymentMethod?: PaymentMethod;

  @ApiProperty({ description: '상품 금액 합', example: 900 })
  totalProductAmount: number;

  @ApiProperty({ description: '청구된 배송비', example: 60 })
  shippingFee: number;

  @ApiProperty({ description: '외섬 여부', example: false })
  isRemoteIsland: boolean;

  @ApiProperty({
    description: '주문 시점의 무료배송 임계금액',
    example: 1150,
  })
  freeShippingThreshold: number;

  @ApiProperty({
    description: '국제배송비 지원 할인액 스냅샷(NT$). 없으면 0',
    example: 120,
  })
  internationalDiscount: number;

  @ApiProperty({ description: '최종 결제 금액', example: 960 })
  totalAmount: number;

  @ApiProperty({
    description: '주문 상태 문구 (Accept-Language 로 번역)',
    example: '已付款',
  })
  statusLabel: string;

  @ApiProperty({
    description:
      '배송 6단계 코드. 결제·취소·환불 상태와 독립이다. 해외배송 중은 실제 국제운송이 시작된 때만, 대만 도착은 통관 완료와 다르다',
    enum: DeliveryStage,
    example: DeliveryStage.ORDER_CONFIRMED,
  })
  deliveryStage: DeliveryStage;

  @ApiProperty({ description: '배송 단계 문구', example: '訂單確認' })
  deliveryStageLabel: string;

  @ApiProperty({ description: '진행바 위치 (1~6)', example: 1 })
  deliveryStep: number;

  @ApiProperty({ description: '주문 일시' })
  orderedAt: Date;

  @ApiPropertyOptional({ description: '결제 완료 시각', nullable: true })
  paidAt: Date | null;

  @ApiPropertyOptional({
    description: '실제 수령·배송 완료 시각. 배송 완료 전이면 null',
    nullable: true,
  })
  deliveredAt: Date | null;

  @ApiPropertyOptional({ description: '대만 국내운송사', nullable: true })
  localCarrier: string | null;

  @ApiPropertyOptional({
    description: '대만 국내운송장 번호',
    nullable: true,
  })
  localTrackingNo: string | null;

  @ApiProperty({
    description:
      '취소·계약해제 신청 버튼을 보여도 되는지. 결제 완료 주문이면 발주·해외배송·수령 뒤에도 true 다. 이미 접수했으면 false',
    example: true,
  })
  canRequestCancel: boolean;

  @ApiProperty({
    description:
      '24시간 간편취소 구간인지(서버 시각 기준). 안내 문구만 바꾸는 값이다 — false 여도 canRequestCancel 이 true 면 신청 경로를 숨기지 않는다',
    example: true,
  })
  isQuickCancelPeriod: boolean;

  @ApiPropertyOptional({
    description: '간편취소 구간이 끝나는 시각 (결제 완료 + 24시간)',
    nullable: true,
  })
  quickCancelUntil: Date | null;

  @ApiPropertyOptional({
    description: '취소·계약해제를 접수한 시각. 접수 전이면 null',
    nullable: true,
  })
  cancellationRequestedAt: Date | null;

  @ApiPropertyOptional({
    description:
      '가장 최근 결제 시도. 결제를 시작하기 전이면 null. 입금 대기면 depositInfo 에 ATM 계좌·편의점 코드가 있다',
    type: GetOrderPaymentResponse,
    nullable: true,
  })
  payment: GetOrderPaymentResponse | null;

  @ApiPropertyOptional({
    description:
      '가장 최근 환불. 환불이 시작되지 않았으면 null. 결제 후 24시간 안 · 발주 전에 취소를 신청하면 신청 직후에 생긴다(자동 환불). ' +
      '전액이 환불되면 주문 status 가 CANCELED 로 바뀌고, 부분 환불이면 PAID 그대로다',
    type: GetUserOrderRefundResponse,
    nullable: true,
  })
  refund: GetUserOrderRefundResponse | null;

  @ApiProperty({
    description:
      '지금까지 환불이 완료된 합계 NT$. 부분 환불이 여러 번이면 더한 값이다. 없으면 0',
    example: 0,
  })
  refundedAmount: number;

  @ApiPropertyOptional({
    description:
      '전자발표. 결제가 확정되면 서버가 발행해 invoiceNo 가 채워진다',
    type: GetOrderInvoiceResponse,
    nullable: true,
  })
  invoice: GetOrderInvoiceResponse | null;

  @ApiProperty({ description: '주문 라인', type: [GetUserOrderItemResponse] })
  items: GetUserOrderItemResponse[];

  @ApiProperty({ description: '배송지', type: GetUserOrderShippingResponse })
  shipping: GetUserOrderShippingResponse;

  static from(
    entity: OrderEntity,
    payment?: PaymentEntity | null,
    language?: LanguageCode,
    refunds: RefundEntity[] = [],
  ) {
    const refund = refunds[refunds.length - 1];

    return plainToInstance(this, {
      refund: refund ? this.toRefund(refund) : null,
      refundedAmount: getRefundedAmount(refunds),
      orderId: entity.id,
      orderNumber: entity.orderNumber,
      status: entity.status,
      statusLabel: getOrderStatusLabel(entity.status, language),
      deliveryStage: entity.deliveryStage,
      deliveryStageLabel: getDeliveryStageLabel(entity.deliveryStage, language),
      deliveryStep: getDeliveryStep(entity.deliveryStage),
      paymentMethod: entity.paymentMethod,
      totalProductAmount: entity.totalProductAmount,
      shippingFee: entity.shippingFeeApplied,
      isRemoteIsland: entity.isRemoteIsland,
      freeShippingThreshold: entity.freeShippingThresholdSnapshot,
      internationalDiscount: entity.internationalDiscount,
      totalAmount: entity.totalAmount,
      orderedAt: entity.createDate,
      paidAt: entity.paidAt ?? null,
      deliveredAt: entity.deliveredAt ?? null,
      localCarrier: entity.localCarrier ?? null,
      localTrackingNo: entity.localTrackingNo ?? null,
      canRequestCancel: canRequestCancel(entity),
      isQuickCancelPeriod: isQuickCancelPeriod(entity, new Date()),
      quickCancelUntil:
        entity.status === OrderStatus.PAID
          ? getReadyAt(entity.paidAt ?? null)
          : null,
      cancellationRequestedAt: entity.cancellationRequestedAt ?? null,
      payment: payment ? GetOrderPaymentResponse.from(payment) : null,
      invoice: entity.invoice
        ? GetOrderInvoiceResponse.from(entity.invoice)
        : null,
      items: (entity.items ?? []).map((item) =>
        GetUserOrderItemResponse.from(item),
      ),
      shipping: this.toShipping(entity),
    });
  }

  /** 처리자·PG 응답 같은 내부 값은 고객에게 주지 않는다 */
  private static toRefund(refund: RefundEntity) {
    return {
      status: refund.status,
      amount: refund.amount,
      requestedAt: refund.requestedAt,
      completedAt: refund.completedAt ?? null,
    };
  }

  private static toShipping(entity: OrderEntity) {
    const shipping = entity.shipping;

    if (!shipping) {
      return null;
    }

    return {
      shippingType: shipping.shippingType,
      recipientName: shipping.recipientName,
      phone: shipping.phone,
      postalCode: shipping.postalCode,
      city: shipping.city,
      district: shipping.district,
      detailAddress: shipping.detailAddress,
      requestMessage: shipping.requestMessage,
      cvsStore: shipping.cvsStoreId
        ? {
            logisticsSubType: shipping.cvsLogisticsSubType,
            storeId: shipping.cvsStoreId,
            storeName: shipping.cvsStoreName,
            storeAddress: shipping.cvsStoreAddress,
            storeTelephone: shipping.cvsStoreTelephone,
            isOutsideIsland: !!shipping.cvsOutside,
          }
        : null,
    };
  }
}

export class PostUserOrderCancelRequest {
  @ApiPropertyOptional({
    description: '취소·계약해제 사유 (선택, 500자). 사유가 없어도 접수된다',
    example: '사이즈를 잘못 골랐어요',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class GetUserOrderListRequest {
  @ApiPropertyOptional({
    description:
      'ALL 전체 / IN_PROGRESS 입금 대기·배송 전~배송 중 / COMPLETED 배송 완료 / CANCELED 취소·환불 대상. 결제 전(PENDING) 주문은 어느 필터에도 안 나온다',
    enum: UserOrderListFilter,
    default: UserOrderListFilter.ALL,
  })
  @IsOptional()
  @IsEnum(UserOrderListFilter)
  status: UserOrderListFilter = UserOrderListFilter.ALL;

  @ApiPropertyOptional({
    description: '최근 N개월만. 생략하면 전체 기간',
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  months?: number;

  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기 (최대 50)', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  count: number = 10;
}

export class GetUserOrderListItemResponse {
  @ApiProperty({ description: '주문 ID', example: 481 })
  orderId: number;

  @ApiProperty({ description: '주문번호', example: 'SM-20260903-000481' })
  orderNumber: string;

  @ApiProperty({ description: '주문 일시' })
  orderedAt: Date;

  @ApiPropertyOptional({ description: '결제 완료 시각', nullable: true })
  paidAt: Date | null;

  @ApiProperty({
    description: '주문 상태 코드 (PAID, PAYMENT_WAITING, CANCELED, FAILED)',
    example: 'PAID',
  })
  status: string;

  @ApiProperty({ description: '주문 상태 문구', example: '已付款' })
  statusLabel: string;

  @ApiProperty({
    description:
      '배송 6단계 코드. 취소·환불은 이 값에 섞지 않고 status 로 본다',
    enum: DeliveryStage,
  })
  deliveryStage: DeliveryStage;

  @ApiProperty({ description: '배송 단계 문구', example: '訂單確認' })
  deliveryStageLabel: string;

  @ApiProperty({ description: '진행바 위치 (1~6)', example: 1 })
  deliveryStep: number;

  @ApiProperty({ description: '최종 결제 금액 NT$', example: 3880 })
  totalAmount: number;

  @ApiProperty({ description: '국제배송비 지원 할인액 NT$', example: 120 })
  internationalDiscount: number;

  @ApiProperty({
    description:
      '취소·계약해제가 접수된 주문인지. 배송 진행바에 섞지 않고 배지로 보여준다',
    example: false,
  })
  cancellationRequested: boolean;

  @ApiPropertyOptional({ description: '대표 상품명', nullable: true })
  representativeProductName: string | null;

  @ApiPropertyOptional({ description: '대표 상품 이미지', nullable: true })
  representativeImageUrl: string | null;

  @ApiPropertyOptional({ description: '대표 상품 옵션', nullable: true })
  representativeOptionText: string | null;

  @ApiProperty({
    description: '주문 상품 라인 수 ("외 N건" 계산용)',
    example: 3,
  })
  itemCount: number;

  static from(entity: OrderEntity, language?: LanguageCode) {
    const first = entity.items?.[0];

    return plainToInstance(this, {
      orderId: entity.id,
      orderNumber: entity.orderNumber,
      orderedAt: entity.createDate,
      paidAt: entity.paidAt ?? null,
      status: entity.status,
      statusLabel: getOrderStatusLabel(entity.status, language),
      deliveryStage: entity.deliveryStage,
      deliveryStageLabel: getDeliveryStageLabel(entity.deliveryStage, language),
      deliveryStep: getDeliveryStep(entity.deliveryStage),
      totalAmount: entity.totalAmount,
      internationalDiscount: entity.internationalDiscount,
      cancellationRequested: !!entity.cancellationRequestedAt,
      representativeProductName: first?.productNameSnapshot ?? null,
      representativeImageUrl: first?.imageUrlSnapshot ?? null,
      representativeOptionText: first?.optionTextSnapshot ?? null,
      itemCount: entity.items?.length ?? 0,
    });
  }
}

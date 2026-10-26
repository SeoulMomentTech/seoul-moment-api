import { OrderItemEntity } from '@app/repository/entity/order-item.entity';
import { OrderEntity } from '@app/repository/entity/order.entity';
import { PaymentEntity } from '@app/repository/entity/payment.entity';
import { PaymentMethod, ShippingType } from '@app/repository/enum/order.enum';
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

export class GetUserOrderResponse {
  @ApiProperty({ description: '주문 ID', example: 481 })
  orderId: number;

  @ApiProperty({ description: '주문번호', example: 'SM-20260903-000481' })
  orderNumber: string;

  @ApiProperty({
    description:
      '주문 상태. PENDING 결제 전(결제창 이탈 포함, 다시 결제 가능) / PAYMENT_WAITING ATM·편의점 입금 대기 / PAID 결제 완료 / CANCELED 취소(입금 기한 경과·장기 미결제) / FAILED 결제 후 재고 부족 등으로 환불 대상',
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

  @ApiProperty({ description: '최종 결제 금액', example: 960 })
  totalAmount: number;

  @ApiProperty({ description: '주문 일시' })
  orderedAt: Date;

  @ApiPropertyOptional({ description: '결제 완료 시각', nullable: true })
  paidAt: Date | null;

  @ApiPropertyOptional({
    description:
      '가장 최근 결제 시도. 결제를 시작하기 전이면 null. 입금 대기면 depositInfo 에 ATM 계좌·편의점 코드가 있다',
    type: GetOrderPaymentResponse,
    nullable: true,
  })
  payment: GetOrderPaymentResponse | null;

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

  static from(entity: OrderEntity, payment?: PaymentEntity | null) {
    return plainToInstance(this, {
      orderId: entity.id,
      orderNumber: entity.orderNumber,
      status: entity.status,
      paymentMethod: entity.paymentMethod,
      totalProductAmount: entity.totalProductAmount,
      shippingFee: entity.shippingFeeApplied,
      isRemoteIsland: entity.isRemoteIsland,
      freeShippingThreshold: entity.freeShippingThresholdSnapshot,
      totalAmount: entity.totalAmount,
      orderedAt: entity.createDate,
      paidAt: entity.paidAt ?? null,
      payment: payment ? GetOrderPaymentResponse.from(payment) : null,
      invoice: entity.invoice
        ? GetOrderInvoiceResponse.from(entity.invoice)
        : null,
      items: (entity.items ?? []).map((item) =>
        GetUserOrderItemResponse.from(item),
      ),
      shipping: entity.shipping
        ? {
            shippingType: entity.shipping.shippingType,
            recipientName: entity.shipping.recipientName,
            phone: entity.shipping.phone,
            postalCode: entity.shipping.postalCode,
            city: entity.shipping.city,
            district: entity.shipping.district,
            detailAddress: entity.shipping.detailAddress,
            requestMessage: entity.shipping.requestMessage,
            cvsStore: entity.shipping.cvsStoreId
              ? {
                  logisticsSubType: entity.shipping.cvsLogisticsSubType,
                  storeId: entity.shipping.cvsStoreId,
                  storeName: entity.shipping.cvsStoreName,
                  storeAddress: entity.shipping.cvsStoreAddress,
                  storeTelephone: entity.shipping.cvsStoreTelephone,
                  isOutsideIsland: !!entity.shipping.cvsOutside,
                }
              : null,
          }
        : null,
    });
  }
}

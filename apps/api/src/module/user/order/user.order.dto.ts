import { OrderItemEntity } from '@app/repository/entity/order-item.entity';
import { OrderEntity } from '@app/repository/entity/order.entity';
import { PaymentMethod } from '@app/repository/enum/order.enum';
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
  Max,
  MaxLength,
  ValidateNested,
} from 'class-validator';

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

  @ApiProperty({
    description: 'true 면 user_profile 과 user.phone 을 배송지로 쓴다',
    example: true,
  })
  @IsBoolean()
  @IsDefined()
  useDefaultShipping: boolean;

  @ApiPropertyOptional({
    description: 'useDefaultShipping 이 false 일 때 필수',
    type: UserOrderShippingRequest,
  })
  @ValidateNested()
  @Type(() => UserOrderShippingRequest)
  @IsOptional()
  shipping?: UserOrderShippingRequest;
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
}

export class GetUserOrderResponse {
  @ApiProperty({ description: '주문 ID', example: 481 })
  orderId: number;

  @ApiProperty({ description: '주문번호', example: 'SM-20260903-000481' })
  orderNumber: string;

  @ApiProperty({ description: '주문 상태', example: 'PENDING' })
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

  @ApiProperty({ description: '주문 라인', type: [GetUserOrderItemResponse] })
  items: GetUserOrderItemResponse[];

  @ApiProperty({ description: '배송지', type: GetUserOrderShippingResponse })
  shipping: GetUserOrderShippingResponse;

  static from(entity: OrderEntity) {
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
      items: (entity.items ?? []).map((item) =>
        GetUserOrderItemResponse.from(item),
      ),
      shipping: entity.shipping
        ? {
            recipientName: entity.shipping.recipientName,
            phone: entity.shipping.phone,
            postalCode: entity.shipping.postalCode,
            city: entity.shipping.city,
            district: entity.shipping.district,
            detailAddress: entity.shipping.detailAddress,
            requestMessage: entity.shipping.requestMessage,
          }
        : null,
    });
  }
}

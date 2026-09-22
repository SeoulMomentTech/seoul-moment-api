import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDefined,
  IsInt,
  IsPositive,
  Max,
  ValidateNested,
} from 'class-validator';

import { CartAmountDto } from '../../user/cart/cart.calculator';
import {
  GetUserCartBrandGroupResponse,
  MAX_CART_ITEMS,
  MAX_CART_QUANTITY,
} from '../../user/cart/user.cart.dto';

/**
 * 게스트 장바구니 한 줄. 회원 장바구니와 달리 라인 ID 가 없고 SKU 가 곧 식별자다.
 * Redis 에 이 모양 그대로 담긴다.
 */
export class GuestCartLineDto {
  productVariantId: number;
  quantity: number;

  static from(productVariantId: number, quantity: number): GuestCartLineDto {
    const dto = new GuestCartLineDto();
    dto.productVariantId = productVariantId;
    dto.quantity = quantity;

    return dto;
  }
}

export class PostGuestCartItemRequest {
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

export class PostGuestCartRequest {
  @ApiProperty({
    description:
      '담을 SKU 목록. 한 개만 담을 때도 길이 1 배열로 보낸다. ' +
      '같은 SKU 가 두 번 들어오면 수량을 합쳐서 처리한다.',
    type: [PostGuestCartItemRequest],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_CART_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => PostGuestCartItemRequest)
  @IsDefined()
  items: PostGuestCartItemRequest[];
}

export class PatchGuestCartRequest {
  @ApiProperty({ description: '변경할 수량', example: 2 })
  @IsInt()
  @IsPositive()
  @Max(MAX_CART_QUANTITY)
  @IsDefined()
  quantity: number;
}

export class PostGuestCartItemResponse {
  @ApiProperty({ description: '상품 변형(SKU) ID', example: 101 })
  productVariantId: number;

  @ApiProperty({
    description: '합산된 뒤의 수량. 이미 담겨 있던 수량이 더해진 값이다',
    example: 3,
  })
  quantity: number;

  static from(line: GuestCartLineDto) {
    return plainToInstance(this, {
      productVariantId: line.productVariantId,
      quantity: line.quantity,
    });
  }
}

export class PostGuestCartResponse {
  @ApiProperty({
    description:
      '이 장바구니를 가리키는 게스트 ID. 헤더가 없으면 서버가 새로 발급한다. ' +
      '클라이언트는 저장해 두고 이후 요청의 x-guest-id 헤더에 실어 보낸다',
    example: '0f0c7a1e-6f2a-4a53-9b0b-2f1f2a8f0a11',
  })
  guestId: string;

  @ApiProperty({
    description: '담긴 라인. 요청한 순서를 그대로 지킨다',
    type: [PostGuestCartItemResponse],
  })
  items: PostGuestCartItemResponse[];

  @ApiProperty({ description: '담긴 뒤의 장바구니 라인 수', example: 3 })
  totalCount: number;

  static from(
    guestId: string,
    items: PostGuestCartItemResponse[],
    totalCount: number,
  ) {
    return plainToInstance(this, { guestId, items, totalCount });
  }
}

export class GetGuestCartCountResponse {
  @ApiProperty({ description: '장바구니 라인 수', example: 3 })
  count: number;

  static from(count: number) {
    return plainToInstance(this, { count });
  }
}

/**
 * 회원 장바구니 조회와 같은 모양이다. 화면 컴포넌트를 그대로 쓰라고 맞췄다.
 * 다만 라인의 cartItemId 는 항상 null 이고, 수량 변경·삭제는 productVariantId 로 한다.
 */
export class GetGuestCartResponse {
  @ApiProperty({
    description: '브랜드별 묶음 (표시용. 배송비는 브랜드와 무관하다)',
    type: [GetUserCartBrandGroupResponse],
  })
  brandGroups: GetUserCartBrandGroupResponse[];

  @ApiProperty({
    description: '상품 금액 합 (구매 가능 라인만)',
    example: 1100,
  })
  totalProductAmount: number;

  @ApiProperty({
    description: '예상 배송비. 배송지가 없으므로 본섬 기준이다',
    example: 60,
  })
  estimatedShippingFee: number;

  @ApiProperty({ description: '외섬 배송비 (안내용)', example: 100 })
  remoteIslandFee: number;

  @ApiProperty({ description: '무료배송 임계금액', example: 1150 })
  freeShippingThreshold: number;

  @ApiProperty({
    description: '무료배송까지 남은 금액. 0이면 이미 무료배송이다',
    example: 50,
  })
  amountToFreeShipping: number;

  @ApiProperty({ description: '예상 결제 금액', example: 1160 })
  estimatedTotalAmount: number;

  @ApiProperty({ description: '장바구니 라인 수', example: 1 })
  totalCount: number;

  static from(
    groups: GetUserCartBrandGroupResponse[],
    amount: CartAmountDto,
    remoteIslandFee: number,
    totalCount: number,
  ) {
    return plainToInstance(this, {
      brandGroups: groups,
      totalProductAmount: amount.totalProductAmount,
      estimatedShippingFee: amount.shippingFee,
      remoteIslandFee,
      freeShippingThreshold: amount.freeShippingThreshold,
      amountToFreeShipping: amount.amountToFreeShipping,
      estimatedTotalAmount: amount.totalAmount,
      totalCount,
    });
  }
}

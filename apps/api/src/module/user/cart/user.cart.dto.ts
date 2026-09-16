import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { ProductVariantEntity } from '@app/repository/entity/product-variant.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDefined,
  IsInt,
  IsOptional,
  IsPositive,
  Max,
  ValidateNested,
} from 'class-validator';

import {
  CartAmountDto,
  CartBrandGroupDto,
  CartLineAmountDto,
} from './cart.calculator';
import { MultilingualFieldDto } from '../../dto/multilingual.dto';

/** 한 번에 담을 수 있는 최대 수량. 오타로 999999 가 들어오는 것을 막는다 */
export const MAX_CART_QUANTITY = 999;

/** 한 요청에 담을 수 있는 SKU 수. 상품 하나의 옵션 조합을 모두 골라도 이 안에 든다 */
export const MAX_CART_ITEMS = 50;

/**
 * 옵션값 ID -> 표시 문자열 모음.
 * raw Map 을 서비스 밖으로 흘리지 않도록 조회/조합 로직을 여기에 가둔다.
 */
export class OptionTextCollectionDto {
  private textMap: Record<number, string> = {};

  static from(texts: MultilingualTextEntity[]): OptionTextCollectionDto {
    const dto = new OptionTextCollectionDto();

    for (const text of texts) {
      if (text.fieldName !== 'value') {
        continue;
      }

      if (dto.textMap[text.entityId] === undefined) {
        dto.textMap[text.entityId] = text.textContent;
      }
    }

    return dto;
  }

  getValue(optionValueId: number): string | null {
    return this.textMap[optionValueId] ?? null;
  }

  /** "IVORY / M" — 옵션 정렬 순서를 따른다 */
  buildOptionText(variant: ProductVariantEntity | null | undefined): string {
    const variantOptions = variant?.variantOptions ?? [];

    return variantOptions
      .slice()
      .sort((a, b) => {
        const optionOrder =
          (a.optionValue?.option?.sortOrder ?? 0) -
          (b.optionValue?.option?.sortOrder ?? 0);

        if (optionOrder !== 0) {
          return optionOrder;
        }

        return (
          (a.optionValue?.sortOrder ?? 0) - (b.optionValue?.sortOrder ?? 0)
        );
      })
      .map((variantOption) => this.getValue(variantOption.optionValueId))
      .filter((value): value is string => !!value)
      .join(' / ');
  }
}

/**
 * 브랜드명·상품명·옵션 텍스트를 한 덩어리로 들고 다닌다.
 * 장바구니와 주문서가 같은 조회를 두 번 구현하지 않도록 여기로 모았다.
 */
export class CartTextBundleDto {
  brandTexts: MultilingualTextEntity[] = [];
  productTexts: MultilingualTextEntity[] = [];
  optionTexts: OptionTextCollectionDto = OptionTextCollectionDto.from([]);

  static from(
    brandTexts: MultilingualTextEntity[],
    productTexts: MultilingualTextEntity[],
    optionValueTexts: MultilingualTextEntity[],
  ): CartTextBundleDto {
    const dto = new CartTextBundleDto();
    dto.brandTexts = brandTexts;
    dto.productTexts = productTexts;
    dto.optionTexts = OptionTextCollectionDto.from(optionValueTexts);

    return dto;
  }

  getBrandName(brandId: number | null | undefined): string | null {
    if (!brandId) {
      return null;
    }

    return MultilingualFieldDto.fromByEntityList(
      this.brandTexts.filter((v) => v.entityId === brandId),
      'name',
    ).getContent();
  }

  getProductName(productId: number | null | undefined): string | null {
    if (!productId) {
      return null;
    }

    return MultilingualFieldDto.fromByEntityList(
      this.productTexts.filter((v) => v.entityId === productId),
      'name',
    ).getContent();
  }

  getOptionText(variant: ProductVariantEntity | null | undefined): string {
    return this.optionTexts.buildOptionText(variant);
  }
}

export class PostUserCartItemRequest {
  @ApiProperty({
    description: '상품 변형(SKU) ID. 상품상세 v1 응답의 variants[].id',
    example: 101,
  })
  @IsInt()
  @IsPositive()
  @IsDefined()
  productVariantId: number;

  @ApiProperty({
    description: '수량',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  @Max(MAX_CART_QUANTITY)
  @IsDefined()
  quantity: number;
}

export class PostUserCartRequest {
  @ApiProperty({
    description:
      '담을 SKU 목록. 한 개만 담을 때도 길이 1 배열로 보낸다. ' +
      '같은 SKU 가 두 번 들어오면 수량을 합쳐서 처리한다.',
    type: [PostUserCartItemRequest],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_CART_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => PostUserCartItemRequest)
  @IsDefined()
  items: PostUserCartItemRequest[];
}

export class PatchUserCartRequest {
  @ApiProperty({
    description: '변경할 수량',
    example: 2,
  })
  @IsInt()
  @IsPositive()
  @Max(MAX_CART_QUANTITY)
  @IsDefined()
  quantity: number;
}

export class DeleteUserCartRequest {
  @ApiPropertyOptional({
    description: '삭제할 장바구니 라인 ID 목록. 생략하면 전체를 비운다',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  // ids=1,2,3 과 ids=1&ids=2 를 모두 받는다. 쿼리스트링은 단건일 때
  // 배열이 아니라 문자열로 들어오므로 여기서 형태를 통일한다.
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const raw = Array.isArray(value) ? value : String(value).split(',');

    return raw.map((v) => Number(v));
  })
  ids?: number[];
}

export class PostUserCartItemResponse {
  @ApiProperty({ description: '상품 변형(SKU) ID', example: 101 })
  productVariantId: number;

  @ApiProperty({ description: '장바구니 라인 ID', example: 1 })
  cartItemId: number;

  @ApiProperty({
    description: '합산된 뒤의 라인 수량. 이미 담겨 있던 수량이 더해진 값이다',
    example: 3,
  })
  quantity: number;

  static from(productVariantId: number, cartItemId: number, quantity: number) {
    return plainToInstance(this, { productVariantId, cartItemId, quantity });
  }
}

export class PostUserCartResponse {
  @ApiProperty({
    description: '담긴 라인. 요청한 순서를 그대로 지킨다',
    type: [PostUserCartItemResponse],
  })
  items: PostUserCartItemResponse[];

  @ApiProperty({ description: '담긴 뒤의 장바구니 라인 수', example: 3 })
  totalCount: number;

  static from(items: PostUserCartItemResponse[], totalCount: number) {
    return plainToInstance(this, { items, totalCount });
  }
}

export class GetUserCartCountResponse {
  @ApiProperty({ description: '장바구니 라인 수', example: 3 })
  count: number;

  static from(count: number) {
    return plainToInstance(this, { count });
  }
}

export class GetUserCartItemResponse {
  @ApiProperty({
    description:
      '장바구니 라인 ID. 주문서 미리보기를 items("구매하기")로 부르면 장바구니 라인이 아니라 null 이다',
    example: 1,
    nullable: true,
  })
  cartItemId: number | null;

  @ApiProperty({ description: '상품 아이템 ID', example: 10 })
  productItemId: number;

  @ApiProperty({ description: '상품 변형(SKU) ID', example: 101 })
  productVariantId: number;

  @ApiProperty({ description: '상품 이름', example: '코튼 트윌 오버셔츠' })
  productName: string;

  @ApiProperty({ description: '옵션 조합 텍스트', example: 'IVORY / M' })
  optionText: string;

  @ApiProperty({
    description: '상품 이미지 URL',
    example: 'https://example.com/image.png',
  })
  imageUrl: string;

  @ApiProperty({ description: '정가', example: 1400 })
  price: number;

  @ApiPropertyOptional({ description: '할인가', example: 1280 })
  discountPrice?: number;

  @ApiProperty({ description: '수량', example: 2 })
  quantity: number;

  @ApiProperty({ description: '라인 금액 (적용가 × 수량)', example: 2560 })
  totalPrice: number;

  @ApiProperty({ description: '남은 재고', example: 5 })
  stockQuantity: number;

  @ApiProperty({ description: '품절 여부', example: false })
  isSoldOut: boolean;

  @ApiProperty({
    description: '구매 가능 여부. false 인 라인은 금액 합계에서 제외된다',
    example: true,
  })
  isAvailable: boolean;

  static from(line: CartLineAmountDto, texts: CartTextBundleDto) {
    const variant = line.cartItem.productVariant;
    const productItem = variant?.productItem;

    return plainToInstance(this, {
      cartItemId: line.cartItem.id ?? null,
      productItemId: productItem?.id ?? null,
      productVariantId: line.cartItem.productVariantId,
      productName: texts.getProductName(productItem?.product?.id),
      optionText: texts.getOptionText(variant),
      imageUrl: productItem?.getMainImage() ?? '',
      price: line.unitPrice,
      discountPrice: productItem?.discountPrice,
      quantity: line.cartItem.quantity,
      totalPrice: line.totalPrice,
      stockQuantity: line.getStockQuantity(),
      isSoldOut: line.isSoldOut,
      isAvailable: line.isAvailable,
    });
  }
}

export class GetUserCartBrandGroupResponse {
  @ApiProperty({ description: '브랜드 ID', example: 1 })
  brandId: number;

  @ApiProperty({ description: '브랜드 이름', example: '온도' })
  brandName: string;

  @ApiProperty({
    description: '브랜드 프로필 이미지 URL',
    example: 'https://example.com/brand.png',
  })
  brandProfileImage: string;

  @ApiProperty({
    description: '이 브랜드의 장바구니 라인',
    type: [GetUserCartItemResponse],
  })
  items: GetUserCartItemResponse[];

  @ApiProperty({
    description: '이 브랜드의 상품 금액 합 (구매 가능 라인만)',
    example: 2560,
  })
  productAmount: number;

  static from(group: CartBrandGroupDto, texts: CartTextBundleDto) {
    const brand =
      group.lines[0]?.cartItem.productVariant?.productItem?.product?.brand;

    return plainToInstance(this, {
      brandId: group.brandId,
      brandName: texts.getBrandName(brand?.id) ?? brand?.englishName ?? null,
      brandProfileImage: brand?.getProfileImage() ?? '',
      items: group.lines.map((line) =>
        GetUserCartItemResponse.from(line, texts),
      ),
      productAmount: group.productAmount,
    });
  }
}

export class GetUserCartResponse {
  @ApiProperty({
    description: '브랜드별 묶음 (표시용. 배송비는 브랜드와 무관하다)',
    type: [GetUserCartBrandGroupResponse],
  })
  brandGroups: GetUserCartBrandGroupResponse[];

  @ApiProperty({
    description: '상품 금액 합 (구매 가능 라인만)',
    example: 900,
  })
  totalProductAmount: number;

  @ApiProperty({
    description:
      '예상 배송비. 배송지가 아직 없으므로 본섬 기준이다. 확정은 주문서에서 한다',
    example: 60,
  })
  estimatedShippingFee: number;

  @ApiProperty({ description: '외섬 배송비 (안내용)', example: 100 })
  remoteIslandFee: number;

  @ApiProperty({ description: '무료배송 임계금액', example: 1150 })
  freeShippingThreshold: number;

  @ApiProperty({
    description: '무료배송까지 남은 금액. 0이면 이미 무료배송이다',
    example: 250,
  })
  amountToFreeShipping: number;

  @ApiProperty({ description: '예상 결제 금액', example: 960 })
  estimatedTotalAmount: number;

  @ApiProperty({ description: '장바구니 라인 수', example: 3 })
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

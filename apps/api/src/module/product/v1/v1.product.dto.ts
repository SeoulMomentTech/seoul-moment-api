import { ProductVariantEntity } from '@app/repository/entity/product-variant.entity';
import { ProductVariantStatus } from '@app/repository/enum/product.enum';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

import {
  GetProductDetailBrand,
  GetProductDetailExternal,
  GetProductDetailOptionValue,
  GetProductDetailResponse,
  GetProductResponse,
} from '../product.dto';

/**
 * 옵션 조합 하나 = SKU 하나.
 *
 * 기존 `option` 맵은 getProductOption 의 GROUP BY 때문에 "색 2개, 사이즈 2개"
 * 같은 축별 목록으로 납작해져 있어서, 어떤 조합이 실제로 존재하는지도 그 조합의
 * variantId 도 알 수 없었다. 재고 단위가 product_variant 이므로 장바구니에
 * 담으려면 이 값이 반드시 필요하다.
 */
export class V1GetProductDetailVariant {
  @ApiProperty({ description: '상품 변형(SKU) ID', example: 101 })
  id: number;

  @ApiProperty({ description: 'SKU', example: 'ONDO-SHIRT-IVORY-M' })
  sku: string;

  @ApiProperty({
    description: '이 조합을 이루는 옵션값 ID 목록',
    example: [1, 5],
    type: [Number],
  })
  optionValueIds: number[];

  @ApiProperty({ description: '남은 재고', example: 5 })
  stockQuantity: number;

  @ApiProperty({
    description: '품절 여부. 재고가 없거나 판매 중지된 조합이면 true',
    example: false,
  })
  isSoldOut: boolean;

  static from(entity: ProductVariantEntity) {
    return plainToInstance(this, {
      id: entity.id,
      sku: entity.sku,
      optionValueIds: (entity.variantOptions ?? [])
        .slice()
        .sort(
          (a, b) =>
            (a.optionValue?.option?.sortOrder ?? 0) -
            (b.optionValue?.option?.sortOrder ?? 0),
        )
        .map((variantOption) => variantOption.optionValueId),
      stockQuantity: entity.stockQuantity,
      isSoldOut: !entity.isInStock(),
    });
  }

  static fromList(entities: ProductVariantEntity[]) {
    return entities
      .filter((entity) => entity.status !== ProductVariantStatus.DELETE)
      .map((entity) => V1GetProductDetailVariant.from(entity));
  }
}

/**
 * 상품상세 v1.
 *
 * v0(`GET /product/:id`) 과 달라지는 것은 두 가지뿐이다.
 *  1. `variants` 추가
 *  2. `shippingCost` 제거 — 배송비는 상품이 아니라 배송지로 정해지므로
 *     상품별 값을 노출하면 주문서 금액과 어긋난다.
 * `option` 맵은 프론트가 점진 이행할 수 있도록 그대로 둔다.
 */
export class V1GetProductDetailResponse {
  @ApiProperty({ description: '상품 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '상품 이름', example: '오가닉 코튼 티셔츠' })
  name: string;

  @ApiProperty({ description: '브랜드 정보', type: GetProductDetailBrand })
  brand: GetProductDetailBrand;

  @ApiProperty({ description: '정가', example: 259000 })
  price: number;

  @ApiProperty({ description: '할인가', example: 189000 })
  discountPrice: number;

  @ApiProperty({ description: '원산지', example: '대한민국' })
  origin: string;

  @ApiProperty({ description: '배송 정보 (일)', example: 3 })
  shippingInfo: number;

  @ApiProperty({
    description: '상품 옵션 목록 (축별 값. 조합은 variants 를 볼 것)',
    example: {
      color: [{ id: 1, value: '빨강' }],
      size: [{ id: 5, value: 'S' }],
    },
  })
  option: Record<string, GetProductDetailOptionValue[]>;

  @ApiProperty({
    description: '옵션 조합(SKU) 목록',
    type: [V1GetProductDetailVariant],
  })
  variants: V1GetProductDetailVariant[];

  @ApiProperty({ description: '좋아요 수', example: 54244 })
  like: number;

  @ApiProperty({ description: '리뷰 수', example: 54244 })
  review: number;

  @ApiProperty({ description: '별점 평균', example: 4.5 })
  reviewAverage: number;

  @ApiProperty({
    description: '상품 상세 이미지 URL',
    example: 'https://example.com/product-detail-01.jpg',
  })
  detailImg: string;

  @ApiProperty({
    description: '서브 이미지 URL 목록',
    type: [String],
    example: ['https://example.com/product-sub-01.jpg'],
  })
  subImage: string[];

  @ApiProperty({
    description: '연관 상품 목록',
    type: () => GetProductResponse,
    isArray: true,
  })
  relate: GetProductResponse[];

  @ApiProperty({
    description: '외부 링크 목록',
    type: [GetProductDetailExternal],
  })
  external: GetProductDetailExternal[];

  @ApiProperty({
    description: '좋아요 여부 (로그인 사용자만 확인 가능)',
    example: true,
  })
  isLiked: boolean;

  static from(
    base: GetProductDetailResponse,
    variants: V1GetProductDetailVariant[],
  ) {
    return plainToInstance(this, {
      id: base.id,
      name: base.name,
      brand: base.brand,
      price: base.price,
      discountPrice: base.discountPrice,
      origin: base.origin,
      shippingInfo: base.shippingInfo,
      option: base.option,
      variants,
      like: base.like,
      review: base.review,
      reviewAverage: base.reviewAverage,
      detailImg: base.detailImg,
      subImage: base.subImage,
      relate: base.relate,
      external: base.external,
      isLiked: base.isLiked,
    });
  }
}

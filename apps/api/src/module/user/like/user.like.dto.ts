import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { ProductItemEntity } from '@app/repository/entity/product-item.entity';
import { UserProductLikeEntity } from '@app/repository/entity/user-product-like.entity';
import { UserBrandLikeDto } from '@app/repository/service/user.like.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
} from 'class-validator';

import { ListFilterDto } from '../../admin/admin.dto';
import { MultilingualFieldDto } from '../../dto/multilingual.dto';

export class PostUserProductLikeRequest {
  @ApiProperty({
    description: '상품 아이템 ID',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  @IsDefined()
  productItemId: number;
}

export class PostUserBrandLikeRequest {
  @ApiProperty({
    description: '브랜드 ID',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  @IsDefined()
  brandId: number;
}

export class GetUserProductLikeResponse {
  @ApiProperty({
    description: '상품 아이템 ID',
    example: 1,
  })
  productItemId: number;

  @ApiProperty({
    description: '브랜드 이름',
    example: '51퍼센트',
  })
  brandName: string;

  @ApiProperty({
    description: '상품 이름',
    example: '51퍼센트',
  })
  productName: string;

  @ApiProperty({
    description: '상품 이미지 URL',
    example: 'https://example.com/image.png',
  })
  imageUrl: string;

  @ApiProperty({
    description: '상품 가격',
    example: 10000,
  })
  price: number;

  @ApiPropertyOptional({
    description: '할인 가격',
    example: 10000,
  })
  discountPrice?: number;

  static from(
    entity: UserProductLikeEntity,
    multilingualText: {
      brand: MultilingualTextEntity[];
      product: MultilingualTextEntity[];
    },
  ) {
    const brandTexts = multilingualText.brand.filter(
      (v) => v.entityId === entity.productItem.product.brand.id,
    );
    const productTexts = multilingualText.product.filter(
      (v) => v.entityId === entity.productItem.product.id,
    );

    const brandName = MultilingualFieldDto.fromByEntityList(brandTexts, 'name');
    const productName = MultilingualFieldDto.fromByEntityList(
      productTexts,
      'name',
    );

    return plainToInstance(this, {
      productItemId: entity.productItem.id,
      brandName: brandName.getContent(),
      productName: productName.getContent(),
      imageUrl: entity.productItem.getMainImage(),
      price: entity.productItem.price,
      discountPrice: entity.productItem.discountPrice,
    });
  }
}

export class GetUserProductLikeRequest extends ListFilterDto {
  @ApiPropertyOptional({
    description: '상품 카테고리 ID',
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  productCategoryId?: number;
}

export class GetUserBrandLikeProductResponse {
  @ApiProperty({
    description: '상품 아이템 ID',
    example: 1,
  })
  productItemId: number;

  @ApiProperty({
    description: '상품 이름',
    example: '51퍼센트',
  })
  productName: string;

  @ApiProperty({
    description: '상품 이미지 URL',
    example: 'https://example.com/image.png',
  })
  imageUrl: string;

  @ApiProperty({
    description: '상품 가격',
    example: 10000,
  })
  price: number;

  static from(
    entity: ProductItemEntity,
    multilingualText: MultilingualTextEntity[],
  ) {
    const productTexts = multilingualText.filter(
      (v) => v.entityId === entity.product.id,
    );

    const productName = MultilingualFieldDto.fromByEntityList(
      productTexts,
      'name',
    );

    return plainToInstance(this, {
      productItemId: entity.id,
      productName: productName.getContent(),
      imageUrl: entity.getMainImage(),
      price: entity.price,
    });
  }
}

export class GetUserBrandLikeResponse {
  @ApiProperty({
    description: '브랜드 ID',
    example: 1,
  })
  brandId: number;

  @ApiProperty({
    description: '브랜드 영어 이름',
    example: '51percent',
  })
  englishBrandName: string;

  @ApiProperty({
    description: '브랜드 이름',
    example: '51퍼센트',
  })
  brandName: string;

  @ApiProperty({
    description: '총 좋아요 수',
    example: 100,
  })
  totalLikeCount: number;

  @ApiProperty({
    description: '최근 좋아요한 상품 목록 4개',
    type: [GetUserBrandLikeProductResponse],
  })
  recentProductList: GetUserBrandLikeProductResponse[];

  static from(
    entity: UserBrandLikeDto,
    multilingualText: {
      brand: MultilingualTextEntity[];
      product: MultilingualTextEntity[];
    },
  ) {
    const brandTexts = multilingualText.brand.filter(
      (v) => v.entityId === entity.brand.id,
    );

    const brandName = MultilingualFieldDto.fromByEntityList(brandTexts, 'name');

    return plainToInstance(this, {
      brandId: entity.brand.id,
      englishBrandName: entity.brand.englishName ?? brandName.getContent(),
      brandName: brandName.getContent(),
      totalLikeCount: entity.totalLikeCount,
      recentProductList: entity.brand.products
        .flatMap((v) => v.productItems)
        .sort((a, b) => b.createDate.getTime() - a.createDate.getTime())
        .slice(0, 4)
        .map((p) =>
          GetUserBrandLikeProductResponse.from(p, multilingualText.product),
        ),
    });
  }
}

export class GetUserBrandLikeRequest extends ListFilterDto {}

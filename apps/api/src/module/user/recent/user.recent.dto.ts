import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { ProductItemEntity } from '@app/repository/entity/product-item.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { IsDefined, IsNumber } from 'class-validator';

import { ListFilterDto } from '../../admin/admin.dto';
import { MultilingualFieldDto } from '../../dto/multilingual.dto';

export class GetUserRecentProductResponse {
  @ApiProperty({
    description: '상품 아이템 ID',
    example: 1,
  })
  productItemId: number;

  @ApiProperty({
    description: '브랜드 ID',
    example: 1,
  })
  brandId: number;

  @ApiProperty({
    description: '상품 이름',
    example: '51퍼센트',
  })
  productName: string;

  @ApiProperty({
    description: '브랜드 이름',
    example: '51퍼센트',
  })
  brandName: string;

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

  @ApiProperty({
    description: '좋아요 수',
    example: 100,
  })
  like: number;

  @ApiProperty({
    description: '리뷰 수',
    example: 100,
  })
  review: number;

  @ApiProperty({
    description: '리뷰 평균',
    example: 4.5,
  })
  reviewAverage: number;

  static from(
    entity: ProductItemEntity,
    multilingualText: {
      brand: MultilingualTextEntity[];
      product: MultilingualTextEntity[];
    },
    likeCount: number,
  ) {
    const productTexts = multilingualText.product.filter(
      (v) => v.entityId === entity.product.id,
    );
    const brandTexts = multilingualText.brand.filter(
      (v) => v.entityId === entity.product.brand.id,
    );

    const productName = MultilingualFieldDto.fromByEntityList(
      productTexts,
      'name',
    );

    const brandName = MultilingualFieldDto.fromByEntityList(brandTexts, 'name');

    return plainToInstance(this, {
      productItemId: entity.id,
      brandId: entity.product.brand.id,
      brandName: brandName.getContent(),
      productName: productName.getContent(),
      imageUrl: entity.getMainImage(),
      price: entity.price,
      discountPrice: entity.discountPrice,
      like: likeCount,
      review: Math.floor(Math.random() * 101),
      reviewAverage: Math.round((Math.random() + 4) * 10) / 10,
    });
  }
}

export class PostUserRecentRequest {
  @ApiProperty({
    description: '상품 아이템 ID',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  productItemId: number;
}

export class GetUserRecentRequest extends ListFilterDto {}

import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { ProductCategoryEntity } from '@app/repository/entity/product-category.entity';
import { ProductBannerEntity } from '@app/repository/entity/product_banner.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';

import { MultilingualFieldDto } from '../dto/multilingual.dto';

export class GetProductBannerResponse {
  @ApiProperty({
    description: '상품 배너',
    example: 'https://example.com/image1.jpg',
  })
  banner: string;

  static from(entity: ProductBannerEntity) {
    return plainToInstance(this, {
      banner: entity.getImage(),
    });
  }
}

export class GetProductCategoryResponse {
  @ApiProperty({
    description: 'id',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '상품 카테고리',
    example: '상의(kr), top(en), 上衣(zh)',
  })
  name: string;

  static from(
    entity: ProductCategoryEntity,
    multilingualText: MultilingualTextEntity[],
  ) {
    multilingualText = multilingualText.filter((v) => v.entityId === entity.id);

    const name = MultilingualFieldDto.fromByEntity(multilingualText, 'name');

    return plainToInstance(this, {
      id: entity.id,
      name: name.getContent(),
    });
  }
}

export class GetProductRequest {
  @ApiPropertyOptional({
    description: '브랜드 id',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  brandId: number;

  @ApiPropertyOptional({
    description: '카테고리 id',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  categoryId: number;

  @ApiPropertyOptional({
    description: '상품 카테고리 id',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  productCategoryId: number;
}

export class GetProductResponse {
  @ApiProperty({
    description: '상품 id',
    example: 1,
  })
  id: number;

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
    description: '실제 가격',
    example: 189000,
  })
  price: number;

  @ApiProperty({
    description: '할인 가격',
    example: 120000,
  })
  discountPrice: number;

  @ApiProperty({
    description: '좋아요 수',
    example: 54244,
  })
  like: number;

  @ApiProperty({
    description: '리뷰 수',
    example: 54244,
  })
  review: number;

  @ApiProperty({
    description: '별점 평균',
    example: 4.5,
  })
  reviewAverage: number;

  // TODO 각각 언어별로 text 필요함
  static from() {}
}

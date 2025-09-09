import { DatabaseSort } from '@app/common/enum/global.enum';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { ProductCategoryEntity } from '@app/repository/entity/product-category.entity';
import { ProductColorEntity } from '@app/repository/entity/product-color.entity';
import { ProductBannerEntity } from '@app/repository/entity/product_banner.entity';
import { ProductSortColumn } from '@app/repository/enum/product.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

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
  @ApiProperty({
    description: '현재 페이지',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  @Type(() => Number)
  page: number;

  @ApiProperty({
    description: '보여줄 item 갯수',
    example: 10,
  })
  @IsNumber()
  @IsDefined()
  @Type(() => Number)
  count: number;

  @ApiPropertyOptional({
    description: '정렬할 컬럼 이름',
    example: ProductSortColumn.CREATE,
    default: ProductSortColumn.CREATE,
    enum: ProductSortColumn,
  })
  @IsEnum(ProductSortColumn)
  @IsOptional()
  sortColum?: ProductSortColumn;

  @ApiPropertyOptional({
    description: '오름 차순(asc) 내림 차순(desc)',
    example: DatabaseSort.DESC,
    default: DatabaseSort.DESC,
    enum: DatabaseSort,
  })
  @IsEnum(DatabaseSort)
  @IsOptional()
  sort?: DatabaseSort;

  @ApiPropertyOptional({
    description: '검색어 상품이름',
    example: '홍길동',
  })
  @IsString()
  @IsOptional()
  search?: string;

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

  static from(
    page: number,
    count: number,
    sortColum: ProductSortColumn,
    sort: DatabaseSort,
    search: string,
    brandId: number,
    categoryId: number,
    productCategoryId: number,
  ) {
    return plainToInstance(this, {
      page,
      count,
      sortColum,
      sort,
      search,
      brandId,
      categoryId,
      productCategoryId,
    });
  }

  isNotExistSort(): boolean {
    return !this.sortColum || !this.sort;
  }
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
    description: '가격 (할인 가격이 있으면 할인가격 보여줌)',
    example: 189000,
  })
  price: number;

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

  @ApiProperty({
    description: '상품이미지',
    example: 'https://image-dev.seoulmoment.com.tw/product/product_red_1.png',
  })
  image: string;

  static from(
    entity: ProductColorEntity,
    multilingualText: {
      brand: MultilingualTextEntity[];
      product: MultilingualTextEntity[];
    },
  ) {
    multilingualText.brand = multilingualText.brand.filter(
      (v) => v.entityId === entity.product.brand.id,
    );

    multilingualText.product = multilingualText.product.filter(
      (v) => v.entityId === entity.product.id,
    );

    const brandName = MultilingualFieldDto.fromByEntity(
      multilingualText.brand,
      'name',
    );
    const productName = MultilingualFieldDto.fromByEntity(
      multilingualText.product,
      'name',
    );

    return plainToInstance(this, {
      id: entity.id,
      brandName: brandName.getContent(),
      productName: productName.getContent(),
      price: entity.getEffectivePrice(),
      like: Math.floor(Math.random() * 50001),
      review: Math.floor(Math.random() * 10001),
      reviewAverage: Math.round(Math.random() * 5 * 10) / 10,
      image: entity.getMainImage(),
    });
  }
}

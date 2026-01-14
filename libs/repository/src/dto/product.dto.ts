import { DatabaseSort } from '@app/common/enum/global.enum';
import { RequireKey } from '@app/common/type/require-key.type';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { IsOptional } from 'class-validator';

import { ProductBannerEntity } from '../entity/product-banner.entity';
import { ProductCategoryEntity } from '../entity/product-category.entity';
import { ProductEntity } from '../entity/product.entity';
import { OptionType, ProductSortColumn } from '../enum/product.enum';

export type UpdateProductBannerDto = RequireKey<ProductBannerEntity, 'id'>;
export type UpdateProductDto = RequireKey<ProductEntity, 'id'>;
export type UpdateProductCategoryDto = RequireKey<ProductCategoryEntity, 'id'>;

export class ProductSortDto {
  @ApiProperty({
    description: '정렬할 컬럼',
    enum: ProductSortColumn,
    example: ProductSortColumn.CREATE,
  })
  sortColumn: ProductSortColumn;

  @ApiProperty({
    description: '정렬 방향',
    enum: DatabaseSort,
    example: DatabaseSort.DESC,
  })
  sort: DatabaseSort;

  static from(
    sortColumn: ProductSortColumn,
    sort: DatabaseSort,
  ): ProductSortDto {
    return plainToInstance(this, { sortColumn, sort });
  }
}

export class ProductFilterDto {
  @ApiProperty({
    description: '옵션 값 ID',
    example: 1,
  })
  optionValueId: number;

  @ApiProperty({
    description: '옵션 값 이름',
    example: 'Red',
  })
  name: string;

  @ApiPropertyOptional({
    description: '옵션 값 코드',
    example: 'RED',
  })
  @IsOptional()
  code?: string | null;

  @ApiProperty({
    description: '옵션 타입',
    enum: OptionType,
    example: OptionType.COLOR,
  })
  optionType: OptionType;

  @ApiProperty({
    description: '옵션 UI 타입',
    example: 'color',
  })
  optionUiType: string;
}

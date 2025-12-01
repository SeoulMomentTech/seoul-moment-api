import { DatabaseSort } from '@app/common/enum/global.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { IsOptional } from 'class-validator';

import { OptionType, ProductSortColumn } from '../enum/product.enum';

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
}

import { DatabaseSort } from '@app/common/enum/global.enum';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

import { ProductSortColumn } from '../enum/product.enum';

export class ProductSortDto {
  @ApiProperty({
    description: '정렬할 컬럼',
    enum: ProductSortColumn,
    example: ProductSortColumn.CREATE,
  })
  sortColum: ProductSortColumn;

  @ApiProperty({
    description: '정렬 방향',
    enum: DatabaseSort,
    example: DatabaseSort.DESC,
  })
  sort: DatabaseSort;

  static from(
    sortColum: ProductSortColumn,
    sort: DatabaseSort,
  ): ProductSortDto {
    return plainToInstance(this, { sortColum, sort });
  }
}

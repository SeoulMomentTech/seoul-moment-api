import { DatabaseSort } from '@app/common/enum/global.enum';
import { plainToInstance } from 'class-transformer';

import { ProductSortColumn } from '../enum/product.enum';

export class ProductSortDto {
  sortColum: ProductSortColumn;
  sort: DatabaseSort;

  static from(
    sortColum: ProductSortColumn,
    sort: DatabaseSort,
  ): ProductSortDto {
    return plainToInstance(this, { sortColum, sort });
  }
}

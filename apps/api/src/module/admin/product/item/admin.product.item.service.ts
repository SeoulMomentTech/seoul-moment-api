import { PagingDto } from '@app/common/dto/global.dto';
import { ProductSortDto } from '@app/repository/dto/product.dto';
import { ProductSortColumn } from '@app/repository/enum/product.enum';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { Injectable } from '@nestjs/common';

import {
  GetAdminProductItemRequest,
  GetAdminProductItemResponse,
} from './admin.produict.item.dto';

@Injectable()
export class AdminProductItemService {
  constructor(
    private readonly productRepositoryService: ProductRepositoryService,
  ) {}

  async getAdminProductItem(
    request: GetAdminProductItemRequest,
  ): Promise<[GetAdminProductItemResponse[], number]> {
    const [productItems, count] =
      await this.productRepositoryService.findProductItem(
        PagingDto.from(request.page, request.count),
        ProductSortDto.from(ProductSortColumn.CREATE, request.sort),
        undefined,
        undefined,
        undefined,
        request.search,
      );

    return [
      productItems.map((productItem) =>
        GetAdminProductItemResponse.from(productItem),
      ),
      count,
    ];
  }
}

import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { PagingDto } from '@app/common/dto/global.dto';
import { ResponseListDto } from '@app/common/type/response-list';
import { ProductSortDto } from '@app/repository/dto/product.dto';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import {
  GetAdminProductRequest,
  GetAdminProductResponse,
} from './admin.product.dto';
import { AdminProductService } from './admin.product.service';

@Controller('admin/product')
export class AdminProductController {
  constructor(private readonly adminProductService: AdminProductService) {}

  @Get()
  @ApiOperation({ summary: '대주제 상품 리스트' })
  @ResponseList(GetAdminProductResponse)
  async getAdminProductList(
    @Query() query: GetAdminProductRequest,
  ): Promise<ResponseListDto<GetAdminProductResponse>> {
    const [productList, total] =
      await this.adminProductService.getAdminProductList(
        PagingDto.from(query.page, query.count),
        ProductSortDto.from(query.sortColumn, query.sort),
      );

    return new ResponseListDto(productList, total);
  }
}

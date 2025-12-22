import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { ResponseListDto } from '@app/common/type/response-list';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { AdminProductItemService } from './admin.product.item.service';
import {
  GetAdminProductItemRequest,
  GetAdminProductItemResponse,
} from './admin.produict.item.dto';

@Controller('admin/product/item')
export class AdminProductItemController {
  constructor(
    private readonly adminProductItemService: AdminProductItemService,
  ) {}

  @Get()
  @ApiOperation({ summary: '상품 정보 리스트' })
  @ResponseList(GetAdminProductItemResponse)
  async getAdminProductItem(
    @Query() query: GetAdminProductItemRequest,
  ): Promise<ResponseListDto<GetAdminProductItemResponse>> {
    const [productItems, count] =
      await this.adminProductItemService.getAdminProductItem(query);

    return new ResponseListDto(productItems, count);
  }
}

import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { ResponseListDto } from '@app/common/type/response-list';
import { Controller, Get, Query } from '@nestjs/common';

import {
  AdminProductBannerListRequest,
  AdminProductBannerListResponse,
} from './admin.product.banner.dto';
import { AdminProductBannerService } from './admin.product.banner.service';

@Controller('admin/product/banner')
export class AdminProductBannerController {
  constructor(
    private readonly adminProductBannerService: AdminProductBannerService,
  ) {}

  @Get('list')
  @ResponseList(AdminProductBannerListResponse)
  async getProductBannerList(
    @Query() query: AdminProductBannerListRequest,
  ): Promise<ResponseListDto<AdminProductBannerListResponse>> {
    const [result, total] =
      await this.adminProductBannerService.getProductBannerList(query);
    return new ResponseListDto(result, total);
  }
}

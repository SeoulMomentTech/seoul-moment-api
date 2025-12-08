import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { ResponseListDto } from '@app/common/type/response-list';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import {
  AdminProductBannerListRequest,
  AdminProductBannerListResponse,
  PatchAdminProductBannerRequest,
  PatchAdminProductBannerSortOrderRequest,
  PostAdminProductBannerRequest,
} from './admin.product.banner.dto';
import { AdminProductBannerService } from './admin.product.banner.service';

@Controller('admin/product/banner')
export class AdminProductBannerController {
  constructor(
    private readonly adminProductBannerService: AdminProductBannerService,
  ) {}

  @Get('list')
  @ApiOperation({ summary: '상품 배너 리스트 조회' })
  @ResponseList(AdminProductBannerListResponse)
  async getProductBannerList(
    @Query() query: AdminProductBannerListRequest,
  ): Promise<ResponseListDto<AdminProductBannerListResponse>> {
    const [result, total] =
      await this.adminProductBannerService.getProductBannerList(query);
    return new ResponseListDto(result, total);
  }

  @Post()
  @ApiOperation({ summary: '상품 배너 등록' })
  async postProductBanner(@Body() body: PostAdminProductBannerRequest) {
    await this.adminProductBannerService.postProductBanner(body.imageUrl);
  }

  @Patch('sort')
  @ApiOperation({ summary: '상품 배너 정렬 순서 수정' })
  async patchProductBannerSortOrder(
    @Body() body: PatchAdminProductBannerSortOrderRequest,
  ) {
    await this.adminProductBannerService.patchProductBannerSortOrder(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: '상품 배너 수정' })
  async patchProductBanner(
    @Param('id') id: number,
    @Body() body: PatchAdminProductBannerRequest,
  ) {
    await this.adminProductBannerService.patchProductBanner(id, body.imageUrl);
  }

  @Delete(':id')
  @ApiOperation({ summary: '상품 배너 삭제' })
  async deleteProductBanner(@Param('id') id: number) {
    await this.adminProductBannerService.deleteProductBanner(id);
  }
}

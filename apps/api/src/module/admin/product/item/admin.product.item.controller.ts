import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { ResponseDataDto } from '@app/common/type/response-data';
import { ResponseListDto } from '@app/common/type/response-list';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { AdminProductItemService } from './admin.product.item.service';
import {
  GetAdminProductItemInfoResponse,
  GetAdminProductItemRequest,
  GetAdminProductItemResponse,
  PatchAdminProductItemRequest,
  PostAdminProductItemRequest,
} from './admin.produict.item.dto';

@Controller('admin/product/item')
export class AdminProductItemController {
  constructor(
    private readonly adminProductItemService: AdminProductItemService,
  ) {}

  @Get()
  @ApiOperation({ summary: '상품 아이템 리스트' })
  @ResponseList(GetAdminProductItemResponse)
  async getAdminProductItem(
    @Query() query: GetAdminProductItemRequest,
  ): Promise<ResponseListDto<GetAdminProductItemResponse>> {
    const [productItems, count] =
      await this.adminProductItemService.getAdminProductItem(query);

    return new ResponseListDto(productItems, count);
  }

  @Post()
  @ApiOperation({ summary: '상품 아이템 생성' })
  @HttpCode(HttpStatus.CREATED)
  async postAdminProductItem(@Body() body: PostAdminProductItemRequest) {
    await this.adminProductItemService.postAdminProductItem(body);
  }

  @Get(':id(\\d+)')
  @ApiOperation({ summary: '상품 아이템 상세 조회' })
  @ResponseData(GetAdminProductItemInfoResponse)
  async getAdminProductItemInfo(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetAdminProductItemInfoResponse>> {
    const data = await this.adminProductItemService.getAdminProductItemInfo(id);
    return new ResponseDataDto(data);
  }

  @Patch(':id(\\d+)')
  @ApiOperation({ summary: '상품 아이템 수정' })
  @HttpCode(HttpStatus.ACCEPTED)
  async patchAdminProductItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchAdminProductItemRequest,
  ) {
    await this.adminProductItemService.patchAdminProductItem(id, body);
  }

  @Delete(':id(\\d+)')
  @ApiOperation({ summary: '상품 아이템 삭제' })
  @HttpCode(HttpStatus.ACCEPTED)
  async deleteAdminProductItem(@Param('id', ParseIntPipe) id: number) {
    await this.adminProductItemService.deleteAdminProductItem(id);
  }
}

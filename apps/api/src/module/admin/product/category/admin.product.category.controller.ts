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
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import {
  GetAdminProductCategoryInfoResponse,
  GetAdminProductCategoryRequest,
  GetAdminProductCategoryResponse,
  PatchAdminProductCategoryRequest,
  PostAdminProductCategoryRequest,
} from './admin.product.category.dto';
import { AdminProductCategoryService } from './admin.product.category.service';

@Controller('admin/product/category')
export class AdminProductCategoryController {
  constructor(
    private readonly adminProductCategoryService: AdminProductCategoryService,
  ) {}

  @Get('list')
  @ApiOperation({ summary: '상품 카테고리 목록 조회' })
  @ResponseList(GetAdminProductCategoryResponse)
  async getAdminProductCategoryList(
    @Query() query: GetAdminProductCategoryRequest,
  ): Promise<ResponseListDto<GetAdminProductCategoryResponse>> {
    const [result, total] =
      await this.adminProductCategoryService.getAdminProductCategoryList(query);

    return new ResponseListDto(result, total);
  }

  @Get(':id')
  @ApiOperation({ summary: '상품 카테고리 정보 조회' })
  @ResponseData(GetAdminProductCategoryInfoResponse)
  async getAdminProductCategoryInfo(
    @Param('id') id: number,
  ): Promise<ResponseDataDto<GetAdminProductCategoryInfoResponse>> {
    const result =
      await this.adminProductCategoryService.getAdminProductCategoryInfo(id);

    return new ResponseDataDto(result);
  }

  @Post()
  @ApiOperation({
    summary: 'Product category register',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async postProductCategory(@Body() body: PostAdminProductCategoryRequest) {
    await this.adminProductCategoryService.postAdminProductCategory(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: '상품 카테고리 수정' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async patchProductCategory(
    @Param('id') id: number,
    @Body() body: PatchAdminProductCategoryRequest,
  ) {
    await this.adminProductCategoryService.patchAdminProductCategory(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: '상품 카테고리 삭제' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProductCategory(@Param('id') id: number) {
    await this.adminProductCategoryService.deleteAdminProductCategory(id);
  }
}

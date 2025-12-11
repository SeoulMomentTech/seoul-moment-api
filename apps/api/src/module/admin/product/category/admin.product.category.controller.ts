import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { ResponseListDto } from '@app/common/type/response-list';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import {
  GetAdminProductCategoryRequest,
  GetAdminProductCategoryResponse,
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

  @Post()
  @ApiOperation({
    summary: 'Product category register',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async postProductCategory(@Body() body: PostAdminProductCategoryRequest) {
    await this.adminProductCategoryService.postAdminProductCategory(body);
  }
}

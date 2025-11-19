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
  AdminCategoryListRequest,
  GetAdminCategoryListResponse,
  PostAdminCategoryRequest,
} from './admin.category.dto';
import { AdminCategoryService } from './admin.category.service';

@Controller('admin/category')
export class AdminCategoryController {
  constructor(private readonly adminCategoryService: AdminCategoryService) {}

  @Get()
  @ResponseList(GetAdminCategoryListResponse)
  async getAdminCategoryList(
    @Query() query: AdminCategoryListRequest,
  ): Promise<ResponseListDto<GetAdminCategoryListResponse>> {
    const [result, total] =
      await this.adminCategoryService.getAdminCategoryList(query);
    return new ResponseListDto(result, total);
  }

  @Post()
  @ApiOperation({
    summary: '카테고리 다국어 등록',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async postCategory(@Body() body: PostAdminCategoryRequest) {
    await this.adminCategoryService.postAdminCategory(body);
  }
}

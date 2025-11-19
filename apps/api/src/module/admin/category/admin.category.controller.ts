import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
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
  AdminCategoryListRequest,
  GetAdminCategoryListResponse,
  PostAdminCategoryRequest,
  UpdateAdminCategoryRequest,
} from './admin.category.dto';
import { AdminCategoryService } from './admin.category.service';

@Controller('admin/category')
export class AdminCategoryController {
  constructor(private readonly adminCategoryService: AdminCategoryService) {}

  @Get()
  @ApiOperation({
    summary: '카테고리 목록 조회',
  })
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

  @Delete(':id')
  @ApiOperation({
    summary: '카테고리 삭제',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseException(HttpStatus.NOT_FOUND, '존재하는 카테고리가 없습니다.')
  @ResponseException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    '서버 오류가 발생했습니다.',
  )
  async deleteAdminCategory(@Param('id') id: number) {
    await this.adminCategoryService.deleteAdminCategory(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '카테고리 수정',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseException(HttpStatus.NOT_FOUND, '존재하는 카테고리가 없습니다.')
  @ResponseException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    '서버 오류가 발생했습니다.',
  )
  async updateAdminCategory(
    @Param('id') id: number,
    @Body() body: UpdateAdminCategoryRequest,
  ) {
    await this.adminCategoryService.updateAdminCategory(id, body);
  }
}

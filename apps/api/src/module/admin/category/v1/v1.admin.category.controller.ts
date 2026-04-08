import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { ResponseListDto } from '@app/common/type/response-list';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { OneTimeTokenGuard } from 'apps/api/src/guard/one-time-token.guard';

import { AdminCategoryService } from '../admin.category.service';
import {
  V1GetAdminCategoryResponse,
  V1UpdateAdminCategoryRequest,
} from './v1.admin.category.dto';
import { AdminCategoryListRequest } from '../admin.category.dto';

@Controller('admin/category/v1')
export class V1AdminCategoryController {
  constructor(private readonly adminCategoryService: AdminCategoryService) {}

  @Get()
  @ApiOperation({
    summary: '카테고리 목록 조회',
  })
  @ResponseList(V1GetAdminCategoryResponse)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async v1GetAdminCategoryList(
    @Query() query: AdminCategoryListRequest,
  ): Promise<ResponseListDto<V1GetAdminCategoryResponse>> {
    const [result, total] =
      await this.adminCategoryService.v1GetAdminCategoryList(query);

    return new ResponseListDto(result, total);
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
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async v1UpdateAdminCategory(
    @Param('id') id: number,
    @Body() body: V1UpdateAdminCategoryRequest,
  ) {
    await this.adminCategoryService.v1UpdateAdminCategory(id, body);
  }
}

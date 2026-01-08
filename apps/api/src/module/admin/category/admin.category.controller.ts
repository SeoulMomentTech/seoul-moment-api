import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OneTimeTokenGuard } from 'apps/api/src/guard/one-time-token.guard';

import {
  AdminCategoryListRequest,
  GetAdminCategoryResponse,
  PostAdminCategoryRequest,
  UpdateAdminCategoryRequest,
} from './admin.category.dto';
import { AdminCategoryService } from './admin.category.service';

@ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
@Controller('admin/category')
export class AdminCategoryController {
  constructor(private readonly adminCategoryService: AdminCategoryService) {}

  @Get()
  @ApiOperation({
    summary: '카테고리 목록 조회',
  })
  @ResponseList(GetAdminCategoryResponse)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async getAdminCategoryList(
    @Query() query: AdminCategoryListRequest,
  ): Promise<ResponseListDto<GetAdminCategoryResponse>> {
    const [result, total] =
      await this.adminCategoryService.getAdminCategoryList(query);
    return new ResponseListDto(result, total);
  }

  @Get(':id')
  @ApiOperation({
    summary: '카테고리 정보 조회',
  })
  @ResponseData(GetAdminCategoryResponse)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async getAdminCategoryInfo(
    @Param('id') id: number,
  ): Promise<ResponseDataDto<GetAdminCategoryResponse>> {
    const result = await this.adminCategoryService.getAdminCategoryInfo(id);

    return new ResponseDataDto(result);
  }

  @Post()
  @ApiOperation({
    summary: '카테고리 등록',
    description: '카테고리 등록 시 자동으로 영어, 중국어 번역이 됩니다.',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
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
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
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
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async updateAdminCategory(
    @Param('id') id: number,
    @Body() body: UpdateAdminCategoryRequest,
  ) {
    await this.adminCategoryService.updateAdminCategory(id, body);
  }
}

import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { ResponseListDto } from '@app/common/type/response-list';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OneTimeTokenGuard } from 'apps/api/src/guard/one-time-token.guard';

import {
  AdminArticleListRequest,
  GetAdminArticleInfoResponse,
  GetAdminArticleResponse,
  PostAdminArticleRequest,
  UpdateAdminArticleRequest,
} from './admin.article.dto';
import { AdminArticleService } from './admin.article.service';

@ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
@Controller('admin/article')
@UseGuards(OneTimeTokenGuard)
@ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
export class AdminArticleController {
  constructor(private readonly adminArticleService: AdminArticleService) {}

  @Get()
  @ApiOperation({
    summary: '아티클 리스트 조회',
  })
  @ResponseList(GetAdminArticleResponse)
  async getAdminArticleList(
    @Query() query: AdminArticleListRequest,
  ): Promise<ResponseListDto<GetAdminArticleResponse>> {
    const [result, total] =
      await this.adminArticleService.getAdminArticleList(query);

    return new ResponseListDto(result, total);
  }

  @Get(':id')
  @ApiOperation({
    summary: '아티클 다국어 조회',
  })
  @ResponseData(GetAdminArticleInfoResponse)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async getAdminArticleInfo(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetAdminArticleInfoResponse>> {
    const result = await this.adminArticleService.getAdminArticleInfo(id);
    return new ResponseDataDto(result);
  }

  @Post()
  @ApiOperation({
    summary: '아티클 데이터 입력',
  })
  @HttpCode(HttpStatus.CREATED)
  async postArticle(@Body() body: PostAdminArticleRequest) {
    await this.adminArticleService.postAdminArticle(body);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '아티클 수정',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async updateAdminArticle(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAdminArticleRequest,
  ) {
    await this.adminArticleService.updateAdminArticle(id, body);
  }
}

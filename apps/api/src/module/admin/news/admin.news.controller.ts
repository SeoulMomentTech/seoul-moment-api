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
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OneTimeTokenGuard } from 'apps/api/src/guard/one-time-token.guard';

import {
  AdminNewsListRequest,
  GetAdminNewsInfoResponse,
  GetAdminNewsResponse,
  PostAdminNewsRequest,
  UpdateAdminNewsRequest,
  V2UpdateAdminNewsRequest,
} from './admin.news.dto';
import { AdminNewsService } from './admin.news.service';

@ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
@Controller('admin/news')
@UseGuards(OneTimeTokenGuard)
@ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
export class AdminNewsController {
  constructor(private readonly adminNewsService: AdminNewsService) {}

  @Get()
  @ApiOperation({
    summary: '뉴스 리스트 조회',
  })
  @ResponseList(GetAdminNewsResponse)
  async getAdminNewsList(
    @Query() query: AdminNewsListRequest,
  ): Promise<ResponseListDto<GetAdminNewsResponse>> {
    const [result, total] = await this.adminNewsService.getAdminNewsList(query);

    return new ResponseListDto(result, total);
  }

  @Get(':id(\\d+)')
  @ApiOperation({
    summary: '뉴스 다국어 조회',
  })
  @ResponseData(GetAdminNewsInfoResponse)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async getAdminNewsInfo(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetAdminNewsInfoResponse>> {
    const result = await this.adminNewsService.getAdminNewsInfo(id);
    return new ResponseDataDto(result);
  }

  @Post()
  @ApiOperation({
    summary: '뉴스 데이터 입력',
  })
  @HttpCode(HttpStatus.CREATED)
  async postNews(@Body() body: PostAdminNewsRequest) {
    await this.adminNewsService.postAdminNews(body);
  }

  @Patch(':id(\\d+)')
  @ApiOperation({
    summary: '뉴스 수정 --- deprecated',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async updateAdminNews(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAdminNewsRequest,
  ) {
    await this.adminNewsService.updateAdminNews(id, body);
  }

  @Patch('v2/:id(\\d+)')
  @ApiOperation({
    summary: '뉴스 수정 (V2)',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async V2UpdateAdminNews(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: V2UpdateAdminNewsRequest,
  ) {
    await this.adminNewsService.V2UpdateAdminNews(id, body);
  }

  @Delete(':id(\\d+)')
  @ApiOperation({
    summary: '뉴스 삭제',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async deleteAdminNews(@Param('id', ParseIntPipe) id: number) {
    await this.adminNewsService.deleteAdminNews(id);
  }
}

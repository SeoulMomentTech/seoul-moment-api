import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OneTimeTokenGuard } from 'apps/api/src/guard/one-time-token.guard';

import { AdminNewsService } from '../admin.news.service';
import {
  V1GetAdminNewsInfoResponse,
  V1PostAdminNewsRequest,
  V1UpdateAdminNewsRequest,
} from './v1.admin.news.dto';

@ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
@Controller('admin/news/v1')
@UseGuards(OneTimeTokenGuard)
@ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
export class V1AdminNewsController {
  constructor(private readonly adminNewsService: AdminNewsService) {}

  @Get(':id(\\d+)')
  @ApiOperation({
    summary: '뉴스 다국어 조회',
  })
  @ResponseData(V1GetAdminNewsInfoResponse)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async v1GetAdminNewsInfo(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<V1GetAdminNewsInfoResponse>> {
    const result = await this.adminNewsService.getAdminNewsInfo(id);
    return new ResponseDataDto(result);
  }

  @Post()
  @ApiOperation({
    summary: '뉴스 데이터 입력',
  })
  @HttpCode(HttpStatus.CREATED)
  async v1PostAdminNews(@Body() body: V1PostAdminNewsRequest) {
    await this.adminNewsService.v1PostAdminNews(body);
  }

  @Patch(':id(\\d+)')
  @ApiOperation({
    summary: '뉴스 수정',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async v1UpdateAdminNews(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: V1UpdateAdminNewsRequest,
  ) {
    await this.adminNewsService.v1UpdateAdminNews(id, body);
  }
}

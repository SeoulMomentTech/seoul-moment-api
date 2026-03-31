import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OneTimeTokenGuard } from 'apps/api/src/guard/one-time-token.guard';

import { AdminHomeService } from '../admin.home.service';
import {
  V1GetHomeBannerResponse,
  V1PatchHomeBannerRequest,
  V1PostHomeBannerRequest,
} from './admin.home.v1.dto';

@ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
@Controller('admin/home/v1')
export class AdminHomeV1Controller {
  constructor(private readonly adminHomeService: AdminHomeService) {}

  @Get('banner')
  @ApiOperation({ summary: '홈 배너 이미지 리스트 조회 V1' })
  @ResponseList(V1GetHomeBannerResponse)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  @ResponseException(HttpStatus.INTERNAL_SERVER_ERROR, '서버 에러')
  async v1GetHomeBanner(): Promise<ResponseListDto<V1GetHomeBannerResponse>> {
    const result = await this.adminHomeService.v1GetHomeBanner();

    return new ResponseListDto(result);
  }

  @Post('banner')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '홈 배너 이미지 추가 V1' })
  @ResponseException(HttpStatus.INTERNAL_SERVER_ERROR, '서버 에러')
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async v1PostHomeBanner(@Body() body: V1PostHomeBannerRequest) {
    await this.adminHomeService.postHomeBanner(
      body.imageUrl,
      body.mobileImageUrl,
    );
  }

  @Patch('banner/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '홈 배너 이미지 수정 V1' })
  @ResponseException(HttpStatus.NOT_FOUND, '존재하는 홈 배너 이미지가 없음')
  @ResponseException(HttpStatus.INTERNAL_SERVER_ERROR, '서버 에러')
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async v1PatchHomeBanner(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: V1PatchHomeBannerRequest,
  ) {
    await this.adminHomeService.patchHomeBanner(
      id,
      body.imageUrl,
      body.mobileImageUrl,
    );
  }
}

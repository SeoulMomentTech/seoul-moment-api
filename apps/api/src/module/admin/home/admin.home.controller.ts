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
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import {
  GetHomeBannerResponse,
  PatchHomeBannerRequest,
  PostHomeBannerRequest,
} from './admin.home.dto';
import { AdminHomeService } from './admin.home.service';

@Controller('admin/home')
export class AdminHomeController {
  constructor(private readonly adminHomeService: AdminHomeService) {}

  @Get('banner')
  @ApiOperation({ summary: '홈 배너 이미지 리스트 조회' })
  @ResponseList(GetHomeBannerResponse)
  @ResponseException(HttpStatus.INTERNAL_SERVER_ERROR, '서버 에러')
  async getHomeBanner(): Promise<ResponseListDto<GetHomeBannerResponse>> {
    const result = await this.adminHomeService.getHomeBanner();

    return new ResponseListDto(result);
  }

  @Post('banner')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '홈 배너 이미지 추가' })
  @ResponseException(HttpStatus.INTERNAL_SERVER_ERROR, '서버 에러')
  async postHomeBanner(@Body() body: PostHomeBannerRequest) {
    await this.adminHomeService.postHomeBanner(body.image, body.mobileImage);
  }

  @Patch('banner/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '홈 배너 이미지 수정' })
  @ResponseException(HttpStatus.NOT_FOUND, '존재하는 홈 배너 이미지가 없음')
  @ResponseException(HttpStatus.INTERNAL_SERVER_ERROR, '서버 에러')
  async patchHomeBanner(
    @Param('id') id: number,
    @Body() body: PatchHomeBannerRequest,
  ) {
    await this.adminHomeService.patchHomeBanner(
      id,
      body.image,
      body.mobileImage,
    );
  }

  @Delete('banner/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '홈 배너 이미지 삭제' })
  @ResponseException(HttpStatus.NOT_FOUND, '존재하는 홈 배너 이미지가 없음')
  @ResponseException(HttpStatus.INTERNAL_SERVER_ERROR, '서버 에러')
  async deleteHomeBanner(@Param('id') id: number) {
    await this.adminHomeService.deleteHomeBanner(id);
  }
}

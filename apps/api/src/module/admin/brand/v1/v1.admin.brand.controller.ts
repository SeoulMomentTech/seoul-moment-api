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
  V1GetAdminBrandInfoResponse,
  V1GetAdminBrandResponse,
  V1PostAdminBrandRequest,
  V1UpdateAdminBrandRequest,
} from './v1.admin.brand.dto';
import { AdminBrandListRequest } from '../admin.brand.dto';
import { AdminBrandService } from '../admin.brand.service';

@ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
@Controller('admin/brand/v1')
export class V1AdminBrandController {
  constructor(private readonly adminBrandService: AdminBrandService) {}

  @Post()
  @ApiOperation({
    summary: '브랜드 다국어 등록',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async v1PostAdminBrand(@Body() body: V1PostAdminBrandRequest) {
    await this.adminBrandService.v1PostAdminBrand(body);
  }

  @Get(':id(\\d+)')
  @ApiOperation({
    summary: '브랜드 다국어 상세 조회',
  })
  @ResponseData(V1GetAdminBrandInfoResponse)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async v1GetAdminBrandInfo(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<V1GetAdminBrandInfoResponse>> {
    const result = await this.adminBrandService.v1GetAdminBrandInfo(id);
    return new ResponseDataDto(result);
  }

  @Get()
  @ApiOperation({
    summary: '브랜드 리스트 조회',
  })
  @ResponseList(V1GetAdminBrandResponse)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async v1GetAdminBrandList(
    @Query() query: AdminBrandListRequest,
  ): Promise<ResponseListDto<V1GetAdminBrandResponse>> {
    const [result, total] =
      await this.adminBrandService.v1GetAdminBrandList(query);
    return new ResponseListDto(result, total);
  }

  @Patch(':id(\\d+)')
  @ApiOperation({
    summary: '브랜드 수정',
    description: '전체 데이터를 교체하는 방식의 브랜드 수정 API입니다.',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async v1UpdateAdminBrand(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: V1UpdateAdminBrandRequest,
  ) {
    await this.adminBrandService.v1UpdateAdminBrand(id, body);
  }
}

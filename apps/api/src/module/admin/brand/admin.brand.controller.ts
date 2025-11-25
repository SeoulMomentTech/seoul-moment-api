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
  AdminBrandListRequest,
  GetAdminBrandInfoResponse,
  GetAdminBrandResponse,
  PostAdminBrandRequest,
  UpdateAdminBrandRequest,
} from './admin.brand.dto';
import { AdminBrandService } from './admin.brand.service';

@ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
@Controller('admin/brand')
export class AdminBrandController {
  constructor(private readonly adminBrandService: AdminBrandService) {}

  @Post()
  @ApiOperation({
    summary: '브랜드 다국어 등록',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async postAdminBrand(@Body() body: PostAdminBrandRequest) {
    await this.adminBrandService.postAdminBrand(body);
  }

  @Get(':id')
  @ApiOperation({
    summary: '브랜드 다국어 조회',
  })
  @ResponseData(GetAdminBrandInfoResponse)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async getAdminBrandInfo(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetAdminBrandInfoResponse>> {
    const result = await this.adminBrandService.getAdminBrandInfo(id);
    return new ResponseDataDto(result);
  }

  @Get()
  @ApiOperation({
    summary: '브랜드 리스트 조회',
  })
  @ResponseList(GetAdminBrandResponse)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async getAdminBrandList(
    @Query() query: AdminBrandListRequest,
  ): Promise<ResponseListDto<GetAdminBrandResponse>> {
    const [result, total] =
      await this.adminBrandService.getAdminBrandList(query);
    return new ResponseListDto(result, total);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '브랜드 수정',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async updateAdminBrand(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAdminBrandRequest,
  ) {
    await this.adminBrandService.updateAdminBrand(id, body);
  }
}

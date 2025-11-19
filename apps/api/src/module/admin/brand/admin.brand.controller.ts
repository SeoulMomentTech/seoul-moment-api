import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseDataDto } from '@app/common/type/response-data';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import {
  GetAdminBrandInfoResponse,
  PostAdminBrandRequest,
} from './admin.brand.dto';
import { AdminBrandService } from './admin.brand.service';

@Controller('admin/brand')
export class AdminBrandController {
  constructor(private readonly adminBrandService: AdminBrandService) {}

  @Post()
  @ApiOperation({
    summary: '브랜드 다국어 등록',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async postAdminBrand(@Body() body: PostAdminBrandRequest) {
    await this.adminBrandService.postAdminBrand(body);
  }

  @Get(':id')
  @ApiOperation({
    summary: '브랜드 다국어 조회',
  })
  @ResponseData(GetAdminBrandInfoResponse)
  async getAdminBrandInfo(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetAdminBrandInfoResponse>> {
    const result = await this.adminBrandService.getAdminBrandInfo(id);
    return new ResponseDataDto(result);
  }
}

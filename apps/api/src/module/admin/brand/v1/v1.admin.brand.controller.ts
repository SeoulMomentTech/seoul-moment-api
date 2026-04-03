import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OneTimeTokenGuard } from 'apps/api/src/guard/one-time-token.guard';

import { V1PostAdminBrandRequest } from './v1.admin.brand.dto';
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
}

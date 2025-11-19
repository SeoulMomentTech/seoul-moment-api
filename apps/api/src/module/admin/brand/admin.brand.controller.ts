import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { PostAdminBrandRequest } from './admin.brand.dto';
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
}

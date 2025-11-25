import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { Body, Controller, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OneTimeTokenGuard } from 'apps/api/src/guard/one-time-token.guard';

import {
  AdminUploadImageRequest,
  AdminUploadImageResponse,
} from './admin.image.dto';
import { AdminImageService } from './admin.image.service';

@ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
@Controller('admin/image')
export class AdminImageController {
  constructor(private readonly adminImageService: AdminImageService) {}

  @Post('upload')
  @ApiOperation({ summary: '이미지 업로드' })
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  @ResponseData(AdminUploadImageResponse)
  async uploadImage(
    @Body() body: AdminUploadImageRequest,
  ): Promise<ResponseDataDto<AdminUploadImageResponse>> {
    const result = await this.adminImageService.uploadImage(body);
    return new ResponseDataDto(result);
  }
}

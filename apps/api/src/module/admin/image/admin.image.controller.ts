import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseDataDto } from '@app/common/type/response-data';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import {
  AdminUploadImageRequest,
  AdminUploadImageResponse,
} from './admin.image.dto';
import { AdminImageService } from './admin.image.service';

@Controller('admin/image')
export class AdminImageController {
  constructor(private readonly adminImageService: AdminImageService) {}

  @Post('upload')
  @ApiOperation({ summary: '이미지 업로드' })
  @ResponseData(AdminUploadImageResponse)
  async uploadImage(
    @Body() body: AdminUploadImageRequest,
  ): Promise<ResponseDataDto<AdminUploadImageResponse>> {
    const result = await this.adminImageService.uploadImage(body);
    return new ResponseDataDto(result);
  }
}

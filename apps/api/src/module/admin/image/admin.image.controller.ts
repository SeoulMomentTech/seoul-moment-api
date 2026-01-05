import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import {
  Body,
  Controller,
  HttpStatus,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { OneTimeTokenGuard } from 'apps/api/src/guard/one-time-token.guard';

import {
  AdminUploadFileRequest,
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

  @Post('upload/file')
  @ApiOperation({ summary: '이미지 파일 업로드' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('file', 1, {
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
      },
    }),
  )
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  @ResponseData(AdminUploadImageResponse)
  async uploadFile(
    @UploadedFiles() file: Express.Multer.File[],
    @Body() body: AdminUploadFileRequest,
  ): Promise<ResponseDataDto<AdminUploadImageResponse>> {
    const result = await this.adminImageService.uploadFile(
      file[0],
      body.folder,
    );
    return new ResponseDataDto(result);
  }
}

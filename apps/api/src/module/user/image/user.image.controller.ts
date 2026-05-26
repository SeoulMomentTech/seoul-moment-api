import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
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
import { UserOneTimeTokenGuard } from 'apps/api/src/guard/user-one-time-token.guard';

import {
  UserUploadFileRequest,
  UserUploadImageRequest,
  UserUploadImageResponse,
} from './user.image.dto';
import { UserImageService } from './user.image.service';

@ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
@Controller('user/image')
export class UserImageController {
  constructor(private readonly userImageService: UserImageService) {}

  @Post('upload')
  @ApiOperation({ summary: '유저 이미지 업로드 (base64)' })
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  @ResponseData(UserUploadImageResponse)
  async uploadImage(
    @Body() body: UserUploadImageRequest,
  ): Promise<ResponseDataDto<UserUploadImageResponse>> {
    const result = await this.userImageService.uploadImage(body);
    return new ResponseDataDto(result);
  }

  @Post('upload/file')
  @ApiOperation({ summary: '유저 이미지 파일 업로드' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('file', 1, {
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
      },
    }),
  )
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  @ResponseException(HttpStatus.BAD_REQUEST, '파일 없음')
  @ResponseData(UserUploadImageResponse)
  async uploadFile(
    @UploadedFiles() file: Express.Multer.File[],
    @Body() body: UserUploadFileRequest,
  ): Promise<ResponseDataDto<UserUploadImageResponse>> {
    if (!file?.[0]) {
      throw new ServiceError('파일이 없습니다.', ServiceErrorCode.BAD_REQUEST);
    }

    const result = await this.userImageService.uploadFile(file[0], body.folder);
    return new ResponseDataDto(result);
  }
}

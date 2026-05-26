import { LoggerService } from '@app/common/log/logger.service';
import { S3Service } from '@app/external/aws/s3/s3.service';
import { Injectable } from '@nestjs/common';

import {
  UserUploadImageRequest,
  UserUploadImageResponse,
} from './user.image.dto';
import { UserS3ImageFolder } from './user.image.enum';

@Injectable()
export class UserImageService {
  constructor(
    private readonly logger: LoggerService,
    private readonly s3Service: S3Service,
  ) {}

  async uploadImage(
    request: UserUploadImageRequest,
  ): Promise<UserUploadImageResponse> {
    this.logger.info('uploadImage', {
      folder: request.folder,
      base64Length: request.base64.length,
    });

    const base64Data = request.base64.replace(
      /^data:image\/[a-z]+;base64,/,
      '',
    );
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const image = await this.s3Service.uploadImage(imageBuffer, {
      folder: request.folder,
    });

    return {
      imageUrl: image.url,
      imagePath: `/${image.key}`,
    };
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: UserS3ImageFolder,
  ): Promise<UserUploadImageResponse> {
    this.logger.info('uploadFile', {
      folder,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });

    const image = await this.s3Service.uploadImage(file.buffer, {
      folder,
    });

    return {
      imageUrl: image.url,
      imagePath: `/${image.key}`,
    };
  }
}

import { LoggerService } from '@app/common/log/logger.service';
import { S3Service } from '@app/external/aws/s3/s3.service';
import { Injectable } from '@nestjs/common';

import {
  AdminUploadImageRequest,
  AdminUploadImageResponse,
} from './admin.image.dto';

@Injectable()
export class AdminImageService {
  constructor(
    private readonly logger: LoggerService,
    private readonly s3Service: S3Service,
  ) {}

  async uploadImage(
    request: AdminUploadImageRequest,
  ): Promise<AdminUploadImageResponse> {
    this.logger.info('uploadImage', { request });

    // data:image/png;base64, 등의 prefix 제거 후 Buffer로 변환
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
    };
  }
}

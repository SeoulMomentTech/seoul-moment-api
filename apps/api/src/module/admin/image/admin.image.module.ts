import { S3Module } from '@app/external/aws/aws.module';
import { Module } from '@nestjs/common';

import { AdminImageController } from './admin.image.controller';
import { AdminImageService } from './admin.image.service';

@Module({
  imports: [S3Module],
  controllers: [AdminImageController],
  providers: [AdminImageService],
  exports: [AdminImageService],
})
export class AdminImageModule {}

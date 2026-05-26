import { S3Module } from '@app/external/aws/aws.module';
import { Module } from '@nestjs/common';

import { UserImageController } from './user.image.controller';
import { UserImageService } from './user.image.service';

@Module({
  imports: [S3Module],
  controllers: [UserImageController],
  providers: [UserImageService],
  exports: [UserImageService],
})
export class UserImageModule {}

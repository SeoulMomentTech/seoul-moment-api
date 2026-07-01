import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminNewsController } from './admin.news.controller';
import { AdminNewsService } from './admin.news.service';
import { V1AdminNewsController } from './v1/v1.admin.news.controller';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminNewsController, V1AdminNewsController],
  providers: [AdminNewsService],
  exports: [AdminNewsService],
})
export class AdminNewsModule {}

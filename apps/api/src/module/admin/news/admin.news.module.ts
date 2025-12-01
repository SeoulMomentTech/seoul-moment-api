import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminNewsController } from './admin.news.controller';
import { AdminNewsService } from './admin.news.service';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminNewsController],
  providers: [AdminNewsService],
  exports: [AdminNewsService],
})
export class AdminNewsModule {}

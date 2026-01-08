import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminArticleController } from './admin.article.controller';
import { AdminArticleService } from './admin.article.service';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminArticleController],
  providers: [AdminArticleService],
  exports: [AdminArticleService],
})
export class AdminArticleModule {}

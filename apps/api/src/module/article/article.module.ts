import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { ArticleController } from './article.controller';
import { ArticleService } from './article.service';

@Module({
  imports: [RepositoryModule],
  controllers: [ArticleController],
  providers: [ArticleService],
})
export class ArticleModule {}

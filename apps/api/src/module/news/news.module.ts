import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { NewsController } from './news.controller';
import { NewsService } from './news.service';

@Module({
  imports: [RepositoryModule],
  controllers: [NewsController],
  providers: [NewsService],
})
export class NewsModule {}

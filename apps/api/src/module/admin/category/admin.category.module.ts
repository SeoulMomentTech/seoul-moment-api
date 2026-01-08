import { OpenaiModule } from '@app/external/openai/openai.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminCategoryController } from './admin.category.controller';
import { AdminCategoryService } from './admin.category.service';

@Module({
  imports: [RepositoryModule, OpenaiModule],
  controllers: [AdminCategoryController],
  providers: [AdminCategoryService],
  exports: [AdminCategoryService],
})
export class AdminCategoryModule {}

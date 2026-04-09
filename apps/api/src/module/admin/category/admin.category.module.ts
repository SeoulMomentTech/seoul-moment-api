import { OpenaiModule } from '@app/external/openai/openai.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminCategoryController } from './admin.category.controller';
import { AdminCategoryService } from './admin.category.service';
import { V1AdminCategoryController } from './v1/v1.admin.category.controller';

@Module({
  imports: [RepositoryModule, OpenaiModule],
  controllers: [AdminCategoryController, V1AdminCategoryController],
  providers: [AdminCategoryService],
  exports: [AdminCategoryService],
})
export class AdminCategoryModule {}

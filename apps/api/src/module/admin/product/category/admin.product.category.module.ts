import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminProductCategoryController } from './admin.product.category.controller';
import { AdminProductCategoryService } from './admin.product.category.service';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminProductCategoryController],
  providers: [AdminProductCategoryService],
  exports: [AdminProductCategoryService],
})
export class AdminProductCategoryModule {}

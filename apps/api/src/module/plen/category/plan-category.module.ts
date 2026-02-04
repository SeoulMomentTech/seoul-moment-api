import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { PlanCategoryController } from './plan-category.controller';
import { PlanCategoryService } from './plan-category.service';

@Module({
  imports: [RepositoryModule],
  controllers: [PlanCategoryController],
  providers: [PlanCategoryService],
})
export class PlanCategoryModule {}

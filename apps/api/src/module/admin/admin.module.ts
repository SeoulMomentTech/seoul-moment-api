import { Module } from '@nestjs/common';

import { AdminBrandModule } from './brand/admin.brand.module';
import { AdminCategoryModule } from './category/admin.category.module';
import { AdminHomeModule } from './home/admin.home.module';

@Module({
  imports: [AdminHomeModule, AdminCategoryModule, AdminBrandModule],
})
export class AdminModule {}

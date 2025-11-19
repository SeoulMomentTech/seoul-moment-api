import { Module } from '@nestjs/common';

import { AdminCategoryModule } from './category/admin.category.module';
import { AdminHomeModule } from './home/admin.home.module';

@Module({
  imports: [AdminHomeModule, AdminCategoryModule],
})
export class AdminModule {}

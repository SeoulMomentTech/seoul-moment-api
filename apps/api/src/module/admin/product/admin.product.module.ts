import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminProductController } from './admin.product.controller';
import { AdminProductService } from './admin.product.service';
import { AdminProductBannerModule } from './banner/admin.product.banner.module';
import { AdminProductCategoryModule } from './category/admin.product.category.module';

@Module({
  imports: [
    RepositoryModule,
    AdminProductBannerModule,
    AdminProductCategoryModule,
  ],
  controllers: [AdminProductController],
  providers: [AdminProductService],
})
export class AdminProductModule {}

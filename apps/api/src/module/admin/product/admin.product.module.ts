import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminProductService } from './admin.product.service';
import { AdminProductController } from './admin.produict.controller';
import { AdminProductBannerModule } from './banner/admin.product.banner.module';

@Module({
  imports: [RepositoryModule, AdminProductBannerModule],
  controllers: [AdminProductController],
  providers: [AdminProductService],
})
export class AdminProductModule {}

import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminProductBannerController } from './admin.product.banner.controller';
import { AdminProductBannerService } from './admin.product.banner.service';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminProductBannerController],
  providers: [AdminProductBannerService],
})
export class AdminProductBannerModule {}

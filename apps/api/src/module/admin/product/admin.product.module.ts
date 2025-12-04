import { Module } from '@nestjs/common';

import { AdminProductBannerModule } from './banner/admin.product.banner.module';

@Module({
  imports: [AdminProductBannerModule],
})
export class AdminProductModule {}

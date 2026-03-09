import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminBrandPromotionBannerController } from './admin.brand.promotion.banner.controller';
import { AdminBrandPromotionBannerService } from './admin.brand.promotion.banner.service';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminBrandPromotionBannerController],
  providers: [AdminBrandPromotionBannerService],
})
export class AdminBrandPromotionBannerModule {}

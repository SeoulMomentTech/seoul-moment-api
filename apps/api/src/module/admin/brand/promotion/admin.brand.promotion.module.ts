import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminBrandPromotionController } from './admin.brand.promotion.controller';
import { AdminBrandPromotionService } from './admin.brand.promotion.service';
import { AdminBrandPromotionBannerModule } from './banner/admin.brand.promotion.banner.module';
import { AdminBrandPromotionSectionModule } from './section/admin.brand.promotion.section.module';

@Module({
  imports: [
    RepositoryModule,
    AdminBrandPromotionSectionModule,
    AdminBrandPromotionBannerModule,
  ],
  controllers: [AdminBrandPromotionController],
  providers: [AdminBrandPromotionService],
})
export class AdminBrandPromotionModule {}

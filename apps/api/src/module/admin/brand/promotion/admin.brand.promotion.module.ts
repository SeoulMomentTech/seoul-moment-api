import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminBrandPromotionController } from './admin.brand.promotion.controller';
import { AdminBrandPromotionService } from './admin.brand.promotion.service';
import { AdminBrandPromotionBannerModule } from './banner/admin.brand.promotion.banner.module';
import { AdminBrandPromotionEventModule } from './event/admin.brand.promotion.event.module';
import { AdminBrandPromotionNoticeModule } from './notice/admin.brand.promotion.notice.module';
import { AdminBrandPromotionPopupModule } from './popup/admin.brand.promotion.popup.module';
import { AdminBrandPromotionSectionModule } from './section/admin.brand.promotion.section.module';

@Module({
  imports: [
    RepositoryModule,
    AdminBrandPromotionSectionModule,
    AdminBrandPromotionBannerModule,
    AdminBrandPromotionNoticeModule,
    AdminBrandPromotionPopupModule,
    AdminBrandPromotionEventModule,
  ],
  controllers: [AdminBrandPromotionController],
  providers: [AdminBrandPromotionService],
})
export class AdminBrandPromotionModule {}

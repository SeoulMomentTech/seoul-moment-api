import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminBrandPromotionPopupController } from './admin.brand.promotion.popup.controller';
import { AdminBrandPromotionPopupService } from './admin.brand.promotion.popup.service';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminBrandPromotionPopupController],
  providers: [AdminBrandPromotionPopupService],
  exports: [AdminBrandPromotionPopupService],
})
export class AdminBrandPromotionPopupModule {}

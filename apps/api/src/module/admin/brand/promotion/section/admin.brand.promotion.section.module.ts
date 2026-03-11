import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminBrandPromotionSectionController } from './admin.brand.promotion.section.controller';
import { AdminBrandPromotionSectionService } from './admin.brand.promotion.section.service';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminBrandPromotionSectionController],
  providers: [AdminBrandPromotionSectionService],
  exports: [AdminBrandPromotionSectionService],
})
export class AdminBrandPromotionSectionModule {}

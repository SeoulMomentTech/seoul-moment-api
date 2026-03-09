import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminBrandPromotionController } from './admin.brand.promotion.controller';
import { AdminBrandPromotionService } from './admin.brand.promotion.service';
import { AdminBrandPromotionSectionModule } from './section/admin.brand.promotion.section.module';

@Module({
  imports: [RepositoryModule, AdminBrandPromotionSectionModule],
  controllers: [AdminBrandPromotionController],
  providers: [AdminBrandPromotionService],
})
export class AdminBrandPromotionModule {}

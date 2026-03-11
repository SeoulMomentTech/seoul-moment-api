import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminBrandPromotionNoticsController } from './admin.brand.promotion.notics.controller';
import { AdminBrandPromotionNoticsService } from './admin.brand.promotion.notics.service';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminBrandPromotionNoticsController],
  providers: [AdminBrandPromotionNoticsService],
  exports: [AdminBrandPromotionNoticsService],
})
export class AdminBrandPromotionNoticsModule {}

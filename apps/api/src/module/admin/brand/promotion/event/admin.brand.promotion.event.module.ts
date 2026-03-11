import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminBrandPromotionEventController } from './admin.brand.promotion.event.controller';
import { AdminBrandPromotionEventService } from './admin.brand.promotion.event.service';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminBrandPromotionEventController],
  providers: [AdminBrandPromotionEventService],
  exports: [AdminBrandPromotionEventService],
})
export class AdminBrandPromotionEventModule {}

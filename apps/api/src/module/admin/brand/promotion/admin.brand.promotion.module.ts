import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminBrandPromotionController } from './admin.brand.promotion.controller';
import { AdminBrandPromotionService } from './admin.brand.promotion.service';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminBrandPromotionController],
  providers: [AdminBrandPromotionService],
})
export class AdminBrandPromotionModule {}

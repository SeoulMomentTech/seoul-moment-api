import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { BrandPromotionController } from './brand.promotion.controller';
import { BrandPromotionService } from './brand.promotion.service';
import { V1BrandPromotionController } from './v1/v1.brand.promotion.controller';

@Module({
  imports: [RepositoryModule],
  controllers: [BrandPromotionController, V1BrandPromotionController],
  providers: [BrandPromotionService],
})
export class BrandPromotionModule {}

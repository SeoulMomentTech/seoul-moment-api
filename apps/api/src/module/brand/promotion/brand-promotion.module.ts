import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { BrandPromotionController } from './brand-promotion.controller';
import { BrandPromotionService } from './brand-promotion.service';

@Module({
  imports: [RepositoryModule],
  controllers: [BrandPromotionController],
  providers: [BrandPromotionService],
})
export class BrandPromotionModule {}

import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminPromotionController } from './admin.promotion.controller';
import { AdminPromotionService } from './admin.promotion.service';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminPromotionController],
  providers: [AdminPromotionService],
})
export class AdminPromotionModule {}

import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { AdminBrandPromotionNoticeController } from './admin.brand.promotion.notice.controller';
import { AdminBrandPromotionNoticeService } from './admin.brand.promotion.notice.service';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminBrandPromotionNoticeController],
  providers: [AdminBrandPromotionNoticeService],
  exports: [AdminBrandPromotionNoticeService],
})
export class AdminBrandPromotionNoticeModule {}

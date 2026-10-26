import { CacheModule } from '@app/cache/cache.module';
import { Module } from '@nestjs/common';

import { CvsStoreService } from './cvs-store.service';
import { LogisticsController } from './logistics.controller';

/**
 * 물류 (ECPay). 지금은 편의점 픽업 매장 선택까지다.
 * 출고 시점의 운송장 생성(Express/Create)·라벨 출력은 관리자 주문 화면과 함께 붙인다.
 */
@Module({
  imports: [CacheModule],
  controllers: [LogisticsController],
  providers: [CvsStoreService],
  exports: [CvsStoreService],
})
export class LogisticsModule {}

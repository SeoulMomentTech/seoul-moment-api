import { CommonAuthModule } from '@app/auth/auth.module';
import { Configuration } from '@app/config/configuration';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { UserOrderController } from './user.order.controller';
import { UserOrderService } from './user.order.service';
import { InvoiceModule } from '../../invoice/invoice.module';
import { LogisticsModule } from '../../logistics/logistics.module';
import { RefundModule } from '../../refund/refund.module';
import { UserCartModule } from '../cart/user.cart.module';

@Module({
  imports: [
    RepositoryModule,
    CommonAuthModule.forRoot(Configuration.getConfig().JWT_SECRET),
    // 배송비·금액 계산을 장바구니와 공유한다. 규칙이 두 벌이 되면 안 된다.
    UserCartModule,
    LogisticsModule,
    InvoiceModule,
    // 24시간 안 · 발주 전 취소의 자동 환불
    RefundModule,
  ],
  controllers: [UserOrderController],
  providers: [UserOrderService],
})
export class UserOrderModule {}

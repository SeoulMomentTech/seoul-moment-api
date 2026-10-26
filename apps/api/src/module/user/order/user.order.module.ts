import { CommonAuthModule } from '@app/auth/auth.module';
import { Configuration } from '@app/config/configuration';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { UserOrderController } from './user.order.controller';
import { UserOrderService } from './user.order.service';
import { InvoiceModule } from '../../invoice/invoice.module';
import { LogisticsModule } from '../../logistics/logistics.module';
import { UserCartModule } from '../cart/user.cart.module';

@Module({
  imports: [
    RepositoryModule,
    CommonAuthModule.forRoot(Configuration.getConfig().JWT_SECRET),
    // 배송비·금액 계산을 장바구니와 공유한다. 규칙이 두 벌이 되면 안 된다.
    UserCartModule,
    LogisticsModule,
    InvoiceModule,
  ],
  controllers: [UserOrderController],
  providers: [UserOrderService],
})
export class UserOrderModule {}

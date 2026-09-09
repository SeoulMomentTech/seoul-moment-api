import { CommonAuthModule } from '@app/auth/auth.module';
import { Configuration } from '@app/config/configuration';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { CartAmountCalculator, ShippingFeeCalculator } from './cart.calculator';
import { UserCartController } from './user.cart.controller';
import { UserCartService } from './user.cart.service';

@Module({
  imports: [
    RepositoryModule,
    CommonAuthModule.forRoot(Configuration.getConfig().JWT_SECRET),
  ],
  controllers: [UserCartController],
  providers: [UserCartService, CartAmountCalculator, ShippingFeeCalculator],
  // 주문 모듈이 같은 계산기를 그대로 쓴다. 배송비 규칙이 두 벌이 되면 안 된다.
  exports: [UserCartService, CartAmountCalculator, ShippingFeeCalculator],
})
export class UserCartModule {}

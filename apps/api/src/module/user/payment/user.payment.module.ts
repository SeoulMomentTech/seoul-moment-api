import { CommonAuthModule } from '@app/auth/auth.module';
import { Configuration } from '@app/config/configuration';
import { Module } from '@nestjs/common';

import { UserPaymentController } from './user.payment.controller';
import { PaymentModule } from '../../payment/payment.module';

@Module({
  imports: [
    CommonAuthModule.forRoot(Configuration.getConfig().JWT_SECRET),
    PaymentModule,
  ],
  controllers: [UserPaymentController],
})
export class UserPaymentModule {}

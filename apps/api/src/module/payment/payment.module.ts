import { CacheModule } from '@app/cache/cache.module';
import { ExternalEcpayModule } from '@app/external/ecpay/ecpay.module';
import { ExternalLinePayModule } from '@app/external/linepay/linepay.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { EcpayPaymentService } from './ecpay-payment.service';
import { EcpayCallbackController } from './ecpay.callback.controller';
import { LinePayPaymentService } from './linepay-payment.service';
import { LinePayCallbackController } from './linepay.callback.controller';
import { PaymentBatchService } from './payment-batch.service';
import { PaymentCompletionService } from './payment-completion.service';
import { PaymentResultService } from './payment-result.service';
import { PaymentStartService } from './payment-start.service';
import { PaymentController } from './payment.controller';
import { PaymentScheduler } from './payment.scheduler';
import { StockReservationService } from './stock-reservation.service';
import { InvoiceModule } from '../invoice/invoice.module';

/**
 * 결제 (ECPay 통합결제 · LINE Pay). 결제 시작 API 는 회원 가드가 필요해서
 * user/payment 모듈에 두고, 여기서는 PG 콜백·handoff·결과 조회·배치를 맡는다.
 */
@Module({
  imports: [
    RepositoryModule,
    CacheModule,
    ExternalEcpayModule,
    ExternalLinePayModule,
    InvoiceModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [
    EcpayCallbackController,
    LinePayCallbackController,
    PaymentController,
  ],
  providers: [
    StockReservationService,
    PaymentCompletionService,
    PaymentResultService,
    EcpayPaymentService,
    LinePayPaymentService,
    PaymentStartService,
    PaymentBatchService,
    PaymentScheduler,
  ],
  exports: [PaymentStartService, PaymentBatchService],
})
export class PaymentModule {}

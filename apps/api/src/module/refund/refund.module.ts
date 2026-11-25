import { CacheModule } from '@app/cache/cache.module';
import { ExternalLinePayModule } from '@app/external/linepay/linepay.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { RefundService } from './refund.service';
import { InvoiceModule } from '../invoice/invoice.module';
import { PaymentModule } from '../payment/payment.module';

/** 환불 (LINE Pay API · ECPay 수동). 실행은 관리자 주문 모듈이 가져다 쓴다 */
@Module({
  imports: [
    RepositoryModule,
    CacheModule,
    ExternalLinePayModule,
    // 재고 복구를 결제와 같은 코드로 한다
    PaymentModule,
    InvoiceModule,
  ],
  providers: [RefundService],
  exports: [RefundService],
})
export class RefundModule {}

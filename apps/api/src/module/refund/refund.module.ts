import { CacheModule } from '@app/cache/cache.module';
import { ExternalGoogleModule } from '@app/external/google/google.module';
import { ExternalLinePayModule } from '@app/external/linepay/linepay.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { RefundNoticeService } from './refund-notice.service';
import { RefundService } from './refund.service';
import { InvoiceModule } from '../invoice/invoice.module';
import { PaymentModule } from '../payment/payment.module';

/** 환불 (LINE Pay API · ECPay 수동). 관리자 주문 모듈과 고객 취소 접수(자동 환불)가 쓴다 */
@Module({
  imports: [
    RepositoryModule,
    CacheModule,
    ExternalLinePayModule,
    // 재고 복구를 결제와 같은 코드로 한다
    PaymentModule,
    InvoiceModule,
    // 환불 완료 메일
    ExternalGoogleModule,
  ],
  providers: [RefundService, RefundNoticeService],
  exports: [RefundService],
})
export class RefundModule {}

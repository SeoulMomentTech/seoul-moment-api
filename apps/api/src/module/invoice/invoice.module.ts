import { CacheModule } from '@app/cache/cache.module';
import { ExternalEcpayModule } from '@app/external/ecpay/ecpay.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { InvoiceIssueService } from './invoice-issue.service';
import { InvoiceValidationService } from './invoice-validation.service';

/** 전자발표 (ECPay B2C). 결제 모듈이 발행을, 주문 모듈이 입력값 확인을 가져다 쓴다 */
@Module({
  imports: [RepositoryModule, CacheModule, ExternalEcpayModule],
  providers: [InvoiceIssueService, InvoiceValidationService],
  exports: [InvoiceIssueService, InvoiceValidationService],
})
export class InvoiceModule {}

import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { ExternalEcpayInvoiceService } from './ecpay-invoice.service';
import { ExternalEcpayService } from './ecpay.service';

@Module({
  imports: [HttpModule.register({ timeout: 10_000 })],
  providers: [ExternalEcpayService, ExternalEcpayInvoiceService],
  exports: [ExternalEcpayService, ExternalEcpayInvoiceService],
})
export class ExternalEcpayModule {}

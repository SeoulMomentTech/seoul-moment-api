import { CommonAuthModule } from '@app/auth/auth.module';
import { Configuration } from '@app/config/configuration';
import { Module } from '@nestjs/common';

import { UserInvoiceController } from './user.invoice.controller';
import { InvoiceModule } from '../../invoice/invoice.module';

@Module({
  imports: [
    CommonAuthModule.forRoot(Configuration.getConfig().JWT_SECRET),
    InvoiceModule,
  ],
  controllers: [UserInvoiceController],
})
export class UserInvoiceModule {}

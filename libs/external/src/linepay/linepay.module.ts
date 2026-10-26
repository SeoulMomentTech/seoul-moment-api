import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { ExternalLinePayService } from './linepay.service';

@Module({
  imports: [HttpModule.register({ timeout: 20_000 })],
  providers: [ExternalLinePayService],
  exports: [ExternalLinePayService],
})
export class ExternalLinePayModule {}

import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';

@Module({
  imports: [RepositoryModule],
  controllers: [ShippingController],
  providers: [ShippingService],
})
export class ShippingModule {}

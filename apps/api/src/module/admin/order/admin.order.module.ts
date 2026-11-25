import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { AdminRoleGuard } from 'apps/api/src/guard/admin-role.guard';

import { AdminOrderController } from './admin.order.controller';
import { AdminOrderService } from './admin.order.service';
import { AdminRefundController } from './admin.refund.controller';
import { AdminRefundService } from './admin.refund.service';
import { AdminShipmentController } from './admin.shipment.controller';
import { AdminShipmentService } from './admin.shipment.service';
import { InvoiceModule } from '../../invoice/invoice.module';
import { RefundModule } from '../../refund/refund.module';

@Module({
  imports: [RepositoryModule, RefundModule, InvoiceModule],
  controllers: [
    AdminOrderController,
    AdminShipmentController,
    AdminRefundController,
  ],
  providers: [
    AdminOrderService,
    AdminShipmentService,
    AdminRefundService,
    AdminRoleGuard,
  ],
})
export class AdminOrderModule {}

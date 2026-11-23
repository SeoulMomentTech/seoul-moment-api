import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { AdminRoleGuard } from 'apps/api/src/guard/admin-role.guard';

import { AdminOrderController } from './admin.order.controller';
import { AdminOrderService } from './admin.order.service';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminOrderController],
  providers: [AdminOrderService, AdminRoleGuard],
})
export class AdminOrderModule {}

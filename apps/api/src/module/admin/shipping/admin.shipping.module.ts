import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { AdminRoleGuard } from 'apps/api/src/guard/admin-role.guard';

import { AdminShippingController } from './admin.shipping.controller';
import { AdminShippingService } from './admin.shipping.service';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminShippingController],
  providers: [AdminShippingService, AdminRoleGuard],
})
export class AdminShippingModule {}

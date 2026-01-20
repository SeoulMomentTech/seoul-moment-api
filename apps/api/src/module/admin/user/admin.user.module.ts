import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { AdminRoleGuard } from 'apps/api/src/guard/admin-role.guard';

import { AdminUserController } from './admin.user.controller';
import { AdminUserService } from './admin.user.service';

@Module({
  imports: [RepositoryModule],
  controllers: [AdminUserController],
  providers: [AdminUserService, AdminRoleGuard],
})
export class AdminUserModule {}

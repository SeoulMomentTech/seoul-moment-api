import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';
import { AdminRoleGuard } from 'apps/api/src/guard/admin-role.guard';

import { AdminMemberController } from './admin.member.controller';
import { AdminMemberService } from './admin.member.service';
import { UserWithdrawModule } from '../../user/withdraw/user.withdraw.module';

@Module({
  imports: [RepositoryModule, UserWithdrawModule],
  controllers: [AdminMemberController],
  providers: [AdminMemberService, AdminRoleGuard],
})
export class AdminMemberModule {}

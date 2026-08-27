import { S3Module } from '@app/external/aws/aws.module';
import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { UserWithdrawService } from './user.withdraw.service';

@Module({
  imports: [RepositoryModule, S3Module],
  providers: [UserWithdrawService],
  exports: [UserWithdrawService],
})
export class UserWithdrawModule {}

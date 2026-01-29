import { RepositoryModule } from '@app/repository/repository.module';
import { Module } from '@nestjs/common';

import { PlanAuthController } from './plan.auth.controller';
import { PlanAuthService } from './plan.auth.service';

@Module({
  imports: [RepositoryModule],
  controllers: [PlanAuthController],
  providers: [PlanAuthService],
})
export class PlanAuthModule {}

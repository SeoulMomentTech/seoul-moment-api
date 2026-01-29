import { Module } from '@nestjs/common';

import { PlanAuthModule } from './auth/plan.auth.module';
import { PlenHelloController as PlanHelloController } from './plan.controller';

@Module({
  imports: [PlanAuthModule],
  controllers: [PlanHelloController],
})
export class PlanModule {}

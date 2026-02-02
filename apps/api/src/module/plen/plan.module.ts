import { Module } from '@nestjs/common';

import { PlanAuthModule } from './auth/plan.auth.module';
import { PlenHelloController as PlanHelloController } from './plan.controller';
import { PlanSettingModule } from './setting/plan-setting.module';

@Module({
  imports: [PlanAuthModule, PlanSettingModule],
  controllers: [PlanHelloController],
})
export class PlanModule {}

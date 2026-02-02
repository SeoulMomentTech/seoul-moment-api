import { Module } from '@nestjs/common';

import { PlanAuthModule } from './auth/plan.auth.module';
import { PlenHelloController as PlanHelloController } from './plan.controller';
import { PlanScheduleModule } from './schedule/plan-schedule.module';
import { PlanSettingModule } from './setting/plan-setting.module';
import { PlanUserModule } from './user/plan.user.module';

@Module({
  imports: [
    PlanAuthModule,
    PlanSettingModule,
    PlanUserModule,
    PlanScheduleModule,
  ],
  controllers: [PlanHelloController],
})
export class PlanModule {}

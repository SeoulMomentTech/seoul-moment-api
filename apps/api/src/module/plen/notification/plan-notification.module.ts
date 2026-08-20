import { Module } from '@nestjs/common';

import { PlanNotificationController } from './plan-notification.controller';
import { PlanNotificationService } from './plan-notification.service';
import { PlanPushModule } from '../push/plan-push.module';

@Module({
  imports: [PlanPushModule],
  controllers: [PlanNotificationController],
  providers: [PlanNotificationService],
  exports: [PlanNotificationService],
})
export class PlanNotificationModule {}

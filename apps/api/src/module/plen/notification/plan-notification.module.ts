import { Module } from '@nestjs/common';

import { PlanNotificationController } from './plan-notification.controller';
import { PlanNotificationService } from './plan-notification.service';

@Module({
  controllers: [PlanNotificationController],
  providers: [PlanNotificationService],
  exports: [PlanNotificationService],
})
export class PlanNotificationModule {}

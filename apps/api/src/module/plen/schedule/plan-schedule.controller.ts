import { Controller } from '@nestjs/common';

import { PlanScheduleService } from './plan-schedule.service';

@Controller('plan/schedule')
export class PlanScheduleController {
  constructor(private readonly planScheduleService: PlanScheduleService) {}
}

import { Controller } from '@nestjs/common';

import { PlanAuthService } from './plan.auth.service';

@Controller('plan/auth')
export class PlanAuthController {
  constructor(private readonly planAuthService: PlanAuthService) {}
}

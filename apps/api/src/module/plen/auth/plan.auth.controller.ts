import { PlatformType } from '@app/repository/enum/plan-user.enum';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { PostPlanLoginRequest } from './plan.auth.dto';
import { PlanAuthService } from './plan.auth.service';

@ApiTags('Plan Auth')
@Controller('plan/auth')
export class PlanAuthController {
  constructor(private readonly planAuthService: PlanAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.ACCEPTED)
  async kakaoLogin(@Body() dto: PostPlanLoginRequest) {
    await this.planAuthService.login(dto, PlatformType.KAKAO);
  }
}

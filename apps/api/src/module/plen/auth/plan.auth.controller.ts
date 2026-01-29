import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseDataDto } from '@app/common/type/response-data';
import { PlatformType } from '@app/repository/enum/plan-user.enum';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { PostPlanLoginRequest, PostPlanLoginResponse } from './plan.auth.dto';
import { PlanAuthService } from './plan.auth.service';

@ApiTags('Plan Auth')
@Controller('plan/auth')
export class PlanAuthController {
  constructor(private readonly planAuthService: PlanAuthService) {}

  @Post('kakao/login')
  @ResponseData(PostPlanLoginResponse)
  async kakaoLogin(
    @Body() dto: PostPlanLoginRequest,
  ): Promise<ResponseDataDto<PostPlanLoginResponse>> {
    const result = await this.planAuthService.login(dto, PlatformType.KAKAO);

    return new ResponseDataDto(result);
  }
}

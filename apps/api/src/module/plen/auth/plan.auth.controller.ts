import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { PlatformType } from '@app/repository/enum/plan-user.enum';
import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlanApiGuard } from 'apps/api/src/guard/kakao.guard';

import { PlanUserRequest } from '../plan.type';
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

  @Post('logout/all')
  @ApiOperation({
    summary: '모든 기기에서 로그아웃',
    description:
      '이 사용자에게 발급된 모든 토큰을 즉시 무효로 만든다. 다시 쓰려면 모든 기기에서 다시 로그인해야 한다. ' +
      '기기 하나만 끊는 용도가 아니다 — 평소 로그아웃은 그 기기에 저장된 토큰을 지우는 것으로 끝난다. ' +
      '토큰이 샜다고 판단될 때 쓰는 회수 수단이다.',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  async logoutAll(@Request() req: PlanUserRequest): Promise<void> {
    await this.planAuthService.logoutAll(req.user.id);
  }
}

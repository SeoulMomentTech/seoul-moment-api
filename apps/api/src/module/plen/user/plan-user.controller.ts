import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PlanApiGuard } from 'apps/api/src/guard/kakao.guard';

import { GetPlanUserResponse } from './plan-user.dto';
import { PlanUserService } from './plan-user.service';
import { PlanUserRequest } from '../plan.type';

@Controller('plan/user')
export class PlanUserController {
  constructor(private readonly planUserService: PlanUserService) {}

  @Get()
  @ApiOperation({ summary: '플랜 유저 정보 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(GetPlanUserResponse)
  async getPlanUser(
    @Request() req: PlanUserRequest,
  ): Promise<ResponseDataDto<GetPlanUserResponse>> {
    return new ResponseDataDto(GetPlanUserResponse.from(req.user));
  }
}

import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PlanApiGuard } from 'apps/api/src/guard/kakao.guard';

import { PlanUserRequest } from '../plan.type';
import {
  PostPlanSettingRequest,
  PostPlanSettingResponse,
} from './plan-setting.dto';
import { PlanSettingService } from './plan-setting.service';

@Controller('plan/setting')
export class PlanSettingController {
  constructor(private readonly planSettingService: PlanSettingService) {}

  @Post()
  @ApiOperation({
    summary: '플랜 설정',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(PostPlanSettingResponse)
  async postPlanSetting(
    @Request() req: PlanUserRequest,
    @Body() body: PostPlanSettingRequest,
  ): Promise<ResponseDataDto<PostPlanSettingResponse>> {
    const result = await this.planSettingService.postPlanSetting(
      req.user.id,
      body,
    );

    return new ResponseDataDto(result);
  }
}

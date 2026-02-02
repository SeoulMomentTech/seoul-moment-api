import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PlanApiGuard } from 'apps/api/src/guard/kakao.guard';

import { PlanScheduleService } from './plan-schedule.service';
import { PlanUserRequest } from '../plan.type';
import {
  PostPlanScheduleRequest,
  PostPlanScheduleResponse,
} from './plan-schedule.dto';

@Controller('plan/schedule')
export class PlanScheduleController {
  constructor(private readonly planScheduleService: PlanScheduleService) {}

  // TODO 스케줄 등록시 유저 카테고리 넣어야함
  @Post()
  @ApiOperation({ summary: '플랜 스케줄 생성' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(PostPlanScheduleResponse)
  async postPlanSchedule(
    @Request() req: PlanUserRequest,
    @Body() body: PostPlanScheduleRequest,
  ): Promise<ResponseDataDto<PostPlanScheduleResponse>> {
    const result = await this.planScheduleService.postPlanSchedule(
      req.user.id,
      body,
    );

    return new ResponseDataDto(result);
  }
}

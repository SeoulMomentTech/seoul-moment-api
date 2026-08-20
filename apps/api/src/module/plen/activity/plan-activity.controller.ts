import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseListDto } from '@app/common/type/response-list';
import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PlanApiGuard } from 'apps/api/src/guard/kakao.guard';

import {
  GetPlanActivityListRequest,
  GetPlanActivityResponse,
} from './plan-activity.dto';
import { PlanActivityService } from './plan-activity.service';
import { PlanUserRequest } from '../plan.type';

@Controller('plan/activity')
export class PlanActivityController {
  constructor(private readonly planActivityService: PlanActivityService) {}

  @Get('list')
  @ApiOperation({
    summary: '플랜 활동 기록 조회',
    description:
      'roomId 를 주면 그 방의 기록을, 없으면 개인 플랜의 기록을 최신순으로 준다. ' +
      '문장은 앱에서 type 과 필드로 조립한다.',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseList(GetPlanActivityResponse)
  async getPlanActivityList(
    @Request() req: PlanUserRequest,
    @Query() query: GetPlanActivityListRequest,
  ): Promise<ResponseListDto<GetPlanActivityResponse>> {
    const [result, total] = await this.planActivityService.getPlanActivityList(
      req.user.id,
      query.page,
      query.count,
      query.sort,
      query.roomId,
    );

    return new ResponseListDto(result, total);
  }
}

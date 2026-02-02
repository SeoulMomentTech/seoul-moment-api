import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PlanApiGuard } from 'apps/api/src/guard/kakao.guard';

import {
  PatchPlanSettingRequest,
  PatchPlanSettingResponse,
} from './plan-setting.dto';
import { PlanSettingService } from './plan-setting.service';

@Controller('plan/setting')
export class PlanSettingController {
  constructor(private readonly planSettingService: PlanSettingService) {}

  @Patch(
    ':id([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})',
  )
  @ApiOperation({
    summary: '플랜 설정 수정',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(PatchPlanSettingResponse)
  async patchPlanSetting(
    @Param('id') id: string,
    @Body() body: PatchPlanSettingRequest,
  ): Promise<ResponseDataDto<PatchPlanSettingResponse>> {
    const result = await this.planSettingService.patchPlanSetting(id, body);

    return new ResponseDataDto(result);
  }
}

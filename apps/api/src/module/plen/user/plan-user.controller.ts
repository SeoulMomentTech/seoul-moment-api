import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import {
  Body,
  Controller,
  Get,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PlanApiGuard } from 'apps/api/src/guard/kakao.guard';

import {
  GetPlanUserResponse,
  PatchPlanUserRequest,
  PatchPlanUserResponse,
} from './plan-user.dto';
import { PlanUserService } from './plan-user.service';
import { PlanUserRequest } from '../plan.type';
import { GetPlanUserTotalAmountResponse } from '../schedule/plan-schedule.dto';

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

  @Patch()
  @ApiOperation({ summary: '플랜 유저 정보 수정' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(PatchPlanUserResponse)
  async patchPlanUser(
    @Request() req: PlanUserRequest,
    @Body() body: PatchPlanUserRequest,
  ): Promise<ResponseDataDto<PatchPlanUserResponse>> {
    const result = await this.planUserService.patchPlanUser(req.user.id, body);

    return new ResponseDataDto(result);
  }

  @Get('total-amount')
  @ApiOperation({ summary: '플랜 유저 총 금액 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(GetPlanUserTotalAmountResponse)
  async getPlanUserTotalAmount(
    @Request() req: PlanUserRequest,
  ): Promise<ResponseDataDto<GetPlanUserTotalAmountResponse>> {
    const totalAmount = await this.planUserService.getPlanUserTotalAmount(
      req.user.id,
    );
    return new ResponseDataDto(
      GetPlanUserTotalAmountResponse.from(totalAmount),
    );
  }
}

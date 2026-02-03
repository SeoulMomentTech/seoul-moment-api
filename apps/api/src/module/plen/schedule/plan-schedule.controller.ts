import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { ResponseListDto } from '@app/common/type/response-list';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PlanApiGuard } from 'apps/api/src/guard/kakao.guard';

import { PlanScheduleService } from './plan-schedule.service';
import { PlanUserRequest } from '../plan.type';
import {
  GetPlanScheduleDetailResponse,
  GetPlanScheduleListRequest,
  GetPlanScheduleResponse,
  PatchPlanScheduleRequest,
  PatchPlanScheduleResponse,
  PostPlanScheduleRequest,
  PostPlanScheduleResponse,
} from './plan-schedule.dto';

@Controller('plan/schedule')
export class PlanScheduleController {
  constructor(private readonly planScheduleService: PlanScheduleService) {}

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

  @Get('list')
  @ApiOperation({ summary: '플랜 스케줄 목록 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseList(GetPlanScheduleResponse)
  async getPlanScheduleList(
    @Query() query: GetPlanScheduleListRequest,
  ): Promise<ResponseListDto<GetPlanScheduleResponse>> {
    const [result, total] =
      await this.planScheduleService.getPlanScheduleList(query);

    return new ResponseListDto(result, total);
  }

  @Delete(':id(\\d+)')
  @ApiOperation({ summary: '플랜 스케줄 삭제' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  async deletePlanSchedule(@Param('id', ParseIntPipe) id: number) {
    await this.planScheduleService.deletePlanSchedule(id);
  }

  @Get(':id(\\d+)')
  @ApiOperation({ summary: '플랜 스케줄 상세 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(GetPlanScheduleDetailResponse)
  async getPlanScheduleDetail(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetPlanScheduleDetailResponse>> {
    const result = await this.planScheduleService.getPlanScheduleDetail(id);
    return new ResponseDataDto(result);
  }

  @Patch(':id(\\d+)')
  @ApiOperation({ summary: '플랜 스케줄 수정' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(PatchPlanScheduleResponse)
  async patchPlanSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchPlanScheduleRequest,
  ): Promise<ResponseDataDto<PatchPlanScheduleResponse>> {
    const result = await this.planScheduleService.patchPlanSchedule(id, body);
    return new ResponseDataDto(result);
  }
}

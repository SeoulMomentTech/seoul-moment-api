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

import {
  GetCalendarListRequest,
  GetCalendarListResponse,
  GetPlanScheduleDetailResponse,
  GetPlanScheduleListRequest,
  GetPlanScheduleResponse,
  PatchPlanScheduleRequest,
  PatchPlanScheduleResponse,
  PatchPlanScheduleStatusRequest,
  PatchPlanScheduleStatusResponse,
  PostPlanScheduleNotificationRequest,
  PostPlanScheduleRequest,
  PostPlanScheduleResponse,
} from './plan-schedule.dto';
import { PlanScheduleService } from './plan-schedule.service';
import { PlanUserRequest } from '../plan.type';

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

  @Post('notification')
  @ApiOperation({ summary: '플랜 스케줄 알림 전송' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  async postPlanScheduleNotification(
    @Request() req: PlanUserRequest,
    @Body() body: PostPlanScheduleNotificationRequest,
  ) {
    await this.planScheduleService.postPlanScheduleNotification(
      req.user.id,
      body.chatRoomId,
      body.scheduleId,
    );
  }

  @Get('calendar')
  @ApiOperation({ summary: '플랜 스케줄 캘린더 조회 (월별)' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseList(GetCalendarListResponse)
  async getCalendarList(
    @Request() req: PlanUserRequest,
    @Query() query: GetCalendarListRequest,
  ): Promise<ResponseListDto<GetCalendarListResponse>> {
    const result = await this.planScheduleService.getCalendarList(
      req.user.id,
      query.month,
      query.year,
      query.roomId,
    );
    return new ResponseListDto(result);
  }

  @Get('list')
  @ApiOperation({ summary: '플랜 스케줄 목록 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseList(GetPlanScheduleResponse)
  async getPlanScheduleList(
    @Request() req: PlanUserRequest,
    @Query() query: GetPlanScheduleListRequest,
  ): Promise<ResponseListDto<GetPlanScheduleResponse>> {
    const [result, total] = await this.planScheduleService.getPlanScheduleList(
      req.user.id,
      query,
    );

    return new ResponseListDto(result, total);
  }

  @Get('room/:roomId([0-9]+)/list')
  @ApiOperation({ summary: '플랜 스케줄 목록 조회 (방 ID로 조회)' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseList(GetPlanScheduleResponse)
  async getPlanScheduleRoomListByRoomId(
    @Param('roomId') roomId: number,
    @Query() query: GetPlanScheduleListRequest,
  ): Promise<ResponseListDto<GetPlanScheduleResponse>> {
    const [result, total] =
      await this.planScheduleService.getPlanScheduleRoomPlanListByRoomId(
        roomId,
        query,
      );

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

  @Patch('status/:id(\\d+)')
  @ApiOperation({ summary: '플랜 스케줄 상태 수정' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(PatchPlanScheduleStatusResponse)
  async patchPlanScheduleStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchPlanScheduleStatusRequest,
  ): Promise<ResponseDataDto<PatchPlanScheduleStatusResponse>> {
    const result = await this.planScheduleService.patchPlanScheduleStatus(
      id,
      body.status,
    );

    return new ResponseDataDto(result);
  }
}

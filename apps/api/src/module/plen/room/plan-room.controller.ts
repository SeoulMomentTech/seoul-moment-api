import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { ResponseListDto } from '@app/common/type/response-list';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  GetPlanRoomListResponse,
  PatchPlanRoomSpouseRequest,
  GetPlanRoomResponse,
  GetRoomShareCodeResponse,
} from './plan-room.dto';
import { PlanRoomService } from './plan-room.service';
import { PlanUserRequest } from '../plan.type';
import { GetPlanUserTotalAmountResponse } from '../schedule/plan-schedule.dto';
import {
  GetPlanUserAmountCategory,
  GetPlanUserAmountCategoryRequest,
  GetPlanUserAmountResponse,
} from '../user/plan-user.dto';

@Controller('plan/room')
export class PlanRoomController {
  constructor(private readonly planRoomService: PlanRoomService) {}

  @Get('share-code')
  @ApiOperation({ summary: '방 공유 코드 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(GetRoomShareCodeResponse)
  async getPlanRoomShareCode(
    @Request() req: PlanUserRequest,
  ): Promise<ResponseDataDto<GetRoomShareCodeResponse>> {
    return new ResponseDataDto(GetRoomShareCodeResponse.from(req.user));
  }

  @Get(':roomId([0-9]+)')
  @ApiOperation({ summary: '플랜 유저 방 조회 (방 ID로 조회)' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(GetPlanRoomResponse)
  async getPlanRoomInfo(
    @Request() req: PlanUserRequest,
    @Param('roomId', ParseIntPipe) roomId: number,
  ): Promise<ResponseDataDto<GetPlanRoomResponse>> {
    const result = await this.planRoomService.getPlanRoomInfo(
      roomId,
      req.user.id,
    );

    return new ResponseDataDto(result);
  }

  @Get('total-amount/:roomId([0-9]+)')
  @ApiOperation({ summary: '플랜 유저 방 총 금액 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(GetPlanUserTotalAmountResponse)
  async getPlanRoomTotalAmount(
    @Request() req: PlanUserRequest,
    @Param('roomId', ParseIntPipe) roomId: number,
  ): Promise<ResponseDataDto<GetPlanUserTotalAmountResponse>> {
    const result = await this.planRoomService.getPlanRoomTotalAmount(
      roomId,
      req.user.id,
    );
    return new ResponseDataDto(result);
  }

  @Get('amount/detail/:roomId([0-9]+)')
  @ApiOperation({ summary: '플랜 유저 금액 상세 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(GetPlanUserAmountResponse)
  async getPlanUserAmount(
    @Request() req: PlanUserRequest,
    @Param('roomId', ParseIntPipe) roomId: number,
  ): Promise<ResponseDataDto<GetPlanUserAmountResponse>> {
    const amount = await this.planRoomService.getPlanRoomAmount(
      roomId,
      req.user.id,
    );

    return new ResponseDataDto(amount);
  }

  @Get('list')
  @ApiOperation({ summary: '유저가 속해있는 방 리스트' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseList(GetPlanRoomListResponse)
  async getPlanRoomList(
    @Request() req: PlanUserRequest,
  ): Promise<ResponseListDto<GetPlanRoomListResponse>> {
    const result = await this.planRoomService.getPlanRoomList(req.user.id);

    return new ResponseListDto(result);
  }

  @Patch('spouse')
  @ApiOperation({
    summary: '신랑·신부(배우자) 지정 — 방장만. planUserId 를 비우면 해제',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  async patchPlanRoomSpouse(
    @Request() req: PlanUserRequest,
    @Body() body: PatchPlanRoomSpouseRequest,
  ) {
    await this.planRoomService.patchPlanRoomSpouse(
      req.user.id,
      body.planUserId ?? null,
    );
  }

  @Post(':shareCode([0-9a-fA-F-]{36})')
  @ApiOperation({ summary: '플랜 유저 방 생성' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(PlanApiGuard)
  async postPlanRoom(
    @Request() req: PlanUserRequest,
    @Param('shareCode') shareCode: string,
    @Query('as') as?: string,
  ) {
    // 초대 링크가 역할을 지닌다. ?as=spouse 는 신랑·신부용 링크다.
    await this.planRoomService.postPlanRoom(
      req.user.id,
      shareCode,
      as === 'spouse',
    );
  }

  @Get('amount/category-chart/:roomId([0-9]+)')
  @ApiOperation({ summary: '플랜 유저 금액 차트 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseList(GetPlanUserAmountCategory)
  async getPlanUserAmountCategoryChart(
    @Request() req: PlanUserRequest,
    @Param('roomId', ParseIntPipe) roomId: number,
    @Query() query: GetPlanUserAmountCategoryRequest,
  ): Promise<ResponseListDto<GetPlanUserAmountCategory>> {
    const amount = await this.planRoomService.getPlanRoomCategoryChartList(
      roomId,
      query.categoryName,
      req.user.id,
    );

    return new ResponseListDto(amount);
  }
}

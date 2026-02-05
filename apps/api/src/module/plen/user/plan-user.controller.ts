import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { ResponseListDto } from '@app/common/type/response-list';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PlanApiGuard } from 'apps/api/src/guard/kakao.guard';

import {
  GetPlanUserAmountCategory,
  GetPlanUserAmountCategoryRequest,
  GetPlanUserAmountResponse,
  GetPlanUserResponse,
  GetPlanUserRoomMemberResponse,
  PatchPlanUserRequest,
  PatchPlanUserResponse,
  PostPlanUserRoomResponse,
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
    const roomMemberList =
      await this.planUserService.getPlanUserRoomMemberListByUserId(req.user.id);
    return new ResponseDataDto(
      GetPlanUserResponse.from(req.user, roomMemberList),
    );
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

  @Get('amount/detail')
  @ApiOperation({ summary: '플랜 유저 금액 상세 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(GetPlanUserAmountResponse)
  async getPlanUserAmount(
    @Request() req: PlanUserRequest,
  ): Promise<ResponseDataDto<GetPlanUserAmountResponse>> {
    const amount = await this.planUserService.getPlanUserAmount(req.user.id);

    return new ResponseDataDto(amount);
  }

  @Get('amount/category-chart')
  @ApiOperation({ summary: '플랜 유저 금액 상세 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseList(GetPlanUserAmountCategory)
  async getPlanUserAmountCategoryChart(
    @Request() req: PlanUserRequest,
    @Query() query: GetPlanUserAmountCategoryRequest,
  ): Promise<ResponseListDto<GetPlanUserAmountCategory>> {
    const amount = await this.planUserService.getPlanUserCategoryChartList(
      req.user.id,
      query.categoryName,
    );

    return new ResponseListDto(amount);
  }

  @Get('room/member/:shareCode([0-9a-fA-F-]{36})')
  @ApiOperation({ summary: '플랜 유저 방 멤버 목록 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseList(GetPlanUserRoomMemberResponse)
  async getPlanUserRoomMemberList(
    @Param('shareCode') shareCode: string,
  ): Promise<ResponseListDto<GetPlanUserRoomMemberResponse>> {
    const result =
      await this.planUserService.getPlanUserRoomMemberList(shareCode);
    return new ResponseListDto(result);
  }

  @Post('room')
  @ApiOperation({ summary: '플랜 유저 방 생성' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(PostPlanUserRoomResponse)
  async postPlanUserRoom(
    @Request() req: PlanUserRequest,
  ): Promise<ResponseDataDto<PostPlanUserRoomResponse>> {
    const result = await this.planUserService.postPlanUserRoom(req.user.id);
    return new ResponseDataDto(result);
  }

  @Get(':shareCode([0-9a-fA-F-]{36})')
  @ApiOperation({ summary: '플랜 유저 방 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(GetPlanUserResponse)
  async getPlanUserShareRoom(
    @Request() req: PlanUserRequest,
    @Param('shareCode') shareCode: string,
  ): Promise<ResponseDataDto<GetPlanUserResponse>> {
    const result = await this.planUserService.getPlanUserRoom(
      req.user.id,
      shareCode,
    );

    return new ResponseDataDto(result);
  }
}

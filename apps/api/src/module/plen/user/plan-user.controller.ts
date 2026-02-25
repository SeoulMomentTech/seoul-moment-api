import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { ResponseListDto } from '@app/common/type/response-list';
import {
  Body,
  Controller,
  Get,
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
    const roomMemberList =
      await this.planUserService.getPlanUserRoomMemberListByUserId(req.user.id);
    const chatRoomList = await this.planUserService.getUserChatRoomList(
      req.user.id,
    );
    return new ResponseDataDto(
      GetPlanUserResponse.from(req.user, roomMemberList, chatRoomList),
    );
  }

  @Get('total-amount')
  @ApiOperation({ summary: '플랜 유저 총 금액 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(GetPlanUserTotalAmountResponse)
  async getPlanUserTotalAmount(
    @Request() req: PlanUserRequest,
  ): Promise<ResponseDataDto<GetPlanUserTotalAmountResponse>> {
    const result = await this.planUserService.getPlanUserTotalAmount(
      req.user.id,
      req.user.budget,
    );
    return new ResponseDataDto(result);
  }

  @Get('amount/detail')
  @ApiOperation({ summary: '플랜 유저 금액 상세 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(GetPlanUserAmountResponse)
  async getPlanUserAmount(
    @Request() req: PlanUserRequest,
  ): Promise<ResponseDataDto<GetPlanUserAmountResponse>> {
    const amount = await this.planUserService.getPlanUserAmount(req.user);

    return new ResponseDataDto(amount);
  }

  @Get('amount/category-chart')
  @ApiOperation({ summary: '플랜 유저 금액 차트 조회' })
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

  @Post('has-seen-main-guide')
  @ApiOperation({ summary: '메인 가이드 조회 여부 수정' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  async postHasSeenMainGuide(@Request() req: PlanUserRequest) {
    await this.planUserService.postHasSeenMainGuide(req.user.id);
  }

  @Post('has-seen-budget-guide')
  @ApiOperation({ summary: '예산 가이드 조회 여부 수정' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  async postHasSeenBudgetGuide(@Request() req: PlanUserRequest) {
    await this.planUserService.postHasSeenBudgetGuide(req.user.id);
  }

  @Post('has-seen-chat-guide')
  @ApiOperation({ summary: '채팅 가이드 조회 여부 수정' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  async postHasSeenChatGuide(@Request() req: PlanUserRequest) {
    await this.planUserService.postHasSeenChatGuide(req.user.id);
  }
}

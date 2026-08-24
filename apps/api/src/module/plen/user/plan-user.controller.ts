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
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PlanApiGuard } from 'apps/api/src/guard/kakao.guard';

import {
  DeletePlanUserDeviceTokenRequest,
  GetPlanUserAmountCategory,
  GetPlanUserAmountCategoryRequest,
  GetPlanUserAmountResponse,
  GetPlanUserResponse,
  PatchPlanUserRequest,
  PatchPlanUserResponse,
  PostPlanUserDeviceTokenRequest,
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

  @Delete()
  @ApiOperation({
    summary: '회원 탈퇴',
    description:
      '개인을 가리키는 값(소셜 id·이메일·이름·프로필·예식장)을 즉시 비우고 계정을 소프트 삭제한다. ' +
      '같은 소셜 계정으로 다시 로그인하면 새 사용자로 시작한다. ' +
      '채팅 메시지와 견적 후기는 남는다 — 대화는 방에 남은 상대의 것이고, 후기는 원래 익명이다.',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  async deletePlanUser(@Request() req: PlanUserRequest) {
    await this.planUserService.deletePlanUser(req.user.id);
  }

  @Post('device-token')
  @ApiOperation({
    summary: 'FCM 기기 토큰 등록',
    description:
      '앱이 백그라운드/종료 상태일 때 채팅 푸시를 받을 기기를 등록한다. ' +
      '한 유저가 기기를 여러 대 쓸 수 있어 토큰은 여러 개 저장되고, 같은 토큰이 다시 오면 갱신된다.',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  async postPlanUserDeviceToken(
    @Request() req: PlanUserRequest,
    @Body() body: PostPlanUserDeviceTokenRequest,
  ) {
    await this.planUserService.postPlanUserDeviceToken(req.user.id, body);
  }

  @Delete('device-token')
  @ApiOperation({
    summary: 'FCM 기기 토큰 해제',
    description:
      '로그아웃한 기기를 푸시 발송 대상에서 뺀다. 다른 기기의 토큰은 그대로 남는다. ' +
      '이미 지워진 토큰이어도 성공으로 응답한다.',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  async deletePlanUserDeviceToken(
    @Request() req: PlanUserRequest,
    @Body() body: DeletePlanUserDeviceTokenRequest,
  ) {
    await this.planUserService.deletePlanUserDeviceToken(req.user.id, body);
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

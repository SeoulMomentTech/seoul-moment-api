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
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PlanApiGuard } from 'apps/api/src/guard/kakao.guard';

import {
  GetPlanFeedListRequest,
  GetPlanFeedMyStatusResponse,
  GetPlanFeedResponse,
  GetPostableScheduleResponse,
  PlanFeedVoteResponse,
  PostPlanFeedRequest,
  PostPlanFeedVoteRequest,
} from './plan-feed.dto';
import { PlanFeedService } from './plan-feed.service';
import { PlanUserRequest } from '../plan.type';

/**
 * 견적 후기 피드.
 *
 * 방 권한(READ/SPOUSE)과 **무관하다.** 후기는 방이 아니라 개인 자격으로
 * 올린다 — 남의 플랜을 함께 보는 사람도 자기 결혼 준비는 따로 한다.
 * 새 엔드포인트에 방 권한 게이트를 넣지 말 것.
 */
@Controller('plan/feed')
export class PlanFeedController {
  constructor(private readonly planFeedService: PlanFeedService) {}

  @Get('list')
  @ApiOperation({
    summary: '견적 후기 목록',
    description:
      '공개된 후기를 카테고리·지역·금액대로 걸러 준다. 익명 피드라 작성자 id 는 내려가지 않는다.',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseList(GetPlanFeedResponse)
  async getPlanFeedList(
    @Request() req: PlanUserRequest,
    @Query() query: GetPlanFeedListRequest,
  ): Promise<ResponseListDto<GetPlanFeedResponse>> {
    const [result, total] = await this.planFeedService.getPlanFeedList(
      req.user.id,
      query,
    );

    return new ResponseListDto(result, total);
  }

  @Get('my')
  @ApiOperation({ summary: '내가 올린 후기' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseList(GetPlanFeedResponse)
  async getMyPlanFeedList(
    @Request() req: PlanUserRequest,
    @Query() query: GetPlanFeedListRequest,
  ): Promise<ResponseListDto<GetPlanFeedResponse>> {
    const [result, total] = await this.planFeedService.getMyPlanFeedList(
      req.user.id,
      query.page ?? 1,
      query.count ?? 20,
    );

    return new ResponseListDto(result, total);
  }

  @Get('my/status')
  @ApiOperation({
    summary: '내 후기 현황',
    description: '피드 사이드 패널 — 올린 수, 받은 하트, 아직 안 올린 일정 수',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(GetPlanFeedMyStatusResponse)
  async getMyStatus(
    @Request() req: PlanUserRequest,
  ): Promise<ResponseDataDto<GetPlanFeedMyStatusResponse>> {
    return new ResponseDataDto(
      await this.planFeedService.getMyStatus(req.user.id),
    );
  }

  @Get('postable')
  @ApiOperation({
    summary: '후기로 올릴 수 있는 완료 일정',
    description: '완료했는데 아직 후기로 안 올린 일정',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseList(GetPostableScheduleResponse)
  async getPostableSchedules(
    @Request() req: PlanUserRequest,
  ): Promise<ResponseListDto<GetPostableScheduleResponse>> {
    const result = await this.planFeedService.getPostableSchedules(req.user.id);

    return new ResponseListDto(result, result.length);
  }

  @Post()
  @ApiOperation({
    summary: '후기 올리기',
    description:
      'scheduleId 를 주면 그 일정에서 카테고리·업체명·금액·지역을 읽어 온다. ' +
      '주소는 시/구 까지만 저장한다.',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(GetPlanFeedResponse)
  async postPlanFeed(
    @Request() req: PlanUserRequest,
    @Body() body: PostPlanFeedRequest,
  ): Promise<ResponseDataDto<GetPlanFeedResponse>> {
    return new ResponseDataDto(
      await this.planFeedService.postPlanFeed(req.user.id, body),
    );
  }

  @Delete(':id([0-9]+)')
  @ApiOperation({ summary: '내 후기 내리기' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  async deletePlanFeed(
    @Request() req: PlanUserRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<boolean>> {
    await this.planFeedService.deletePlanFeed(req.user.id, id);
    return new ResponseDataDto(true);
  }

  @Post(':id([0-9]+)/vote')
  @ApiOperation({
    summary: '도움이 돼요 / 도움이 안 돼요',
    description:
      '같은 값을 다시 보내면 취소된다. "도움이 안 돼요" 수는 응답에 담기지 않는다.',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(PlanFeedVoteResponse)
  async votePlanFeed(
    @Request() req: PlanUserRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PostPlanFeedVoteRequest,
  ): Promise<ResponseDataDto<PlanFeedVoteResponse>> {
    return new ResponseDataDto(
      await this.planFeedService.votePlanFeed(req.user.id, id, body.value),
    );
  }

  @Delete(':id([0-9]+)/vote')
  @ApiOperation({ summary: '평가 취소' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(PlanFeedVoteResponse)
  async cancelPlanFeedVote(
    @Request() req: PlanUserRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<PlanFeedVoteResponse>> {
    return new ResponseDataDto(
      await this.planFeedService.cancelPlanFeedVote(req.user.id, id),
    );
  }
}

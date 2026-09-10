import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { ResponseListDto } from '@app/common/type/response-list';
import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PlanApiGuard } from 'apps/api/src/guard/kakao.guard';

import {
  GetPlanBragDetailResponse,
  GetPlanBragListRequest,
  GetPlanBragMyStatusResponse,
  GetPlanBragResponse,
  PlanBragLikeResponse,
  PostPlanBragResponse,
} from './plan-brag.dto';
import { PlanBragService } from './plan-brag.service';
import { PlanUserRequest } from '../plan.type';

/**
 * 자랑하기 — 내 웨딩 플랜 한 장을 통째로 올린다.
 *
 * 방 권한(READ/SPOUSE)과 **무관하다.** 피드와 같은 이유다 — 자랑하기는 방이
 * 아니라 개인 자격으로 올린다. 새 엔드포인트에 방 권한 게이트를 넣지 말 것.
 *
 * **피드와 규칙이 정반대다.** 피드는 응답에 planUserId 조차 싣지 않는 철저한
 * 익명인데, 여기는 이름을 내는 것이 목적이다. 피드 코드를 베껴 올 때 익명
 * 처리를 같이 가져오지 말 것.
 */
@Controller('plan/brag')
export class PlanBragController {
  constructor(private readonly planBragService: PlanBragService) {}

  @Get('list')
  @ApiOperation({
    summary: '자랑하기 목록',
    description:
      '올라가 있는 플랜을 최신순·좋아요순으로 준다. liked 는 요청한 사람 기준이다.',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseList(GetPlanBragResponse)
  async getPlanBragList(
    @Request() req: PlanUserRequest,
    @Query() query: GetPlanBragListRequest,
  ): Promise<ResponseListDto<GetPlanBragResponse>> {
    const [result, total] = await this.planBragService.getPlanBragList(
      req.user.id,
      query,
    );

    return new ResponseListDto(result, total);
  }

  /**
   * `my` 는 `:bragId` 보다 **먼저** 와야 한다. 뒤에 두면 `/plan/brag/my` 가
   * 숫자가 아닌 id 로 잡혀 ParseIntPipe 에서 400 이 난다.
   */
  @Get('my')
  @ApiOperation({
    summary: '내 자랑하기 상태',
    description: '대시보드 토글이 읽는다. 한 번도 안 올렸으면 published=false',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(GetPlanBragMyStatusResponse)
  async getMyStatus(
    @Request() req: PlanUserRequest,
  ): Promise<ResponseDataDto<GetPlanBragMyStatusResponse>> {
    return new ResponseDataDto(
      await this.planBragService.getMyStatus(req.user.id),
    );
  }

  @Get(':bragId([0-9]+)')
  @ApiOperation({
    summary: '자랑하기 상세',
    description:
      '내 것이 아니어도 누구나 본다 — 그게 목적이다. 내려간 글은 404 다.',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(GetPlanBragDetailResponse)
  async getPlanBragDetail(
    @Request() req: PlanUserRequest,
    @Param('bragId', ParseIntPipe) bragId: number,
  ): Promise<ResponseDataDto<GetPlanBragDetailResponse>> {
    return new ResponseDataDto(
      await this.planBragService.getPlanBragDetail(req.user.id, bragId),
    );
  }

  @Put()
  @ApiOperation({
    summary: '자랑하기에 올리기',
    description:
      '지금 내 플랜의 스냅샷을 뜬다. 이미 올라가 있으면 아무것도 하지 않는다 — ' +
      '"올린 뒤에는 고칠 수 없다" 가 앱이 사용자에게 한 약속이다.',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(PostPlanBragResponse)
  async publish(
    @Request() req: PlanUserRequest,
  ): Promise<ResponseDataDto<PostPlanBragResponse>> {
    return new ResponseDataDto({
      bragId: await this.planBragService.publish(req.user.id),
    });
  }

  @Delete()
  @ApiOperation({
    summary: '자랑하기에서 내리기',
    description:
      '목록에서 빠지고 상세는 404 가 된다. 행은 남아서 다시 올리면 좋아요가 이어진다.',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  async unpublish(
    @Request() req: PlanUserRequest,
  ): Promise<ResponseDataDto<boolean>> {
    await this.planBragService.unpublish(req.user.id);
    return new ResponseDataDto(true);
  }

  @Post('like/:bragId([0-9]+)')
  @ApiOperation({
    summary: '좋아요',
    description:
      '한 사람이 한 번. 두 번 보내도 수가 늘지 않는다. 자기 것에는 못 누른다.',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(PlanBragLikeResponse)
  async like(
    @Request() req: PlanUserRequest,
    @Param('bragId', ParseIntPipe) bragId: number,
  ): Promise<ResponseDataDto<PlanBragLikeResponse>> {
    return new ResponseDataDto(
      await this.planBragService.like(req.user.id, bragId),
    );
  }

  @Delete('like/:bragId([0-9]+)')
  @ApiOperation({ summary: '좋아요 취소' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(PlanBragLikeResponse)
  async cancelLike(
    @Request() req: PlanUserRequest,
    @Param('bragId', ParseIntPipe) bragId: number,
  ): Promise<ResponseDataDto<PlanBragLikeResponse>> {
    return new ResponseDataDto(
      await this.planBragService.cancelLike(req.user.id, bragId),
    );
  }
}

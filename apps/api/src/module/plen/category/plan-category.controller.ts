import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseListDto } from '@app/common/type/response-list';
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PlanApiGuard } from 'apps/api/src/guard/kakao.guard';

import { GetPlanCategoryResponse } from './plan-category.dto';
import { PlanCategoryService } from './plan-category.service';
import { PlanUserRequest } from '../plan.type';

@Controller('plan/category')
export class PlanCategoryController {
  constructor(private readonly planCategoryService: PlanCategoryService) {}

  @Get('list')
  @ApiOperation({ summary: '카테고리 목록 조회' })
  @ResponseList(GetPlanCategoryResponse)
  async getPlanCategoryList(): Promise<
    ResponseListDto<GetPlanCategoryResponse>
  > {
    const result = await this.planCategoryService.getPlanCategoryList();
    return new ResponseListDto(result);
  }

  @Get('user/list')
  @ApiOperation({ summary: '플랜 유저 카테고리 목록 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseList(GetPlanCategoryResponse)
  async getPlanUserCategoryList(
    @Request() req: PlanUserRequest,
  ): Promise<ResponseListDto<GetPlanCategoryResponse>> {
    const result = await this.planCategoryService.getPlanUserCategoryList(
      req.user.id,
    );
    return new ResponseListDto(result);
  }

  @Get('room/:roomId([0-9]+)/list')
  @ApiOperation({ summary: '플랜 룸 카테고리 목록 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseList(GetPlanCategoryResponse)
  async getPlanRoomCategoryList(
    @Param('roomId', ParseIntPipe) roomId: number,
  ): Promise<ResponseListDto<GetPlanCategoryResponse>> {
    const result =
      await this.planCategoryService.getPlanRoomCategoryList(roomId);
    return new ResponseListDto(result);
  }
}

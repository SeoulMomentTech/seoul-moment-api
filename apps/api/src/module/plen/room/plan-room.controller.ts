import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { ResponseListDto } from '@app/common/type/response-list';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PlanApiGuard } from 'apps/api/src/guard/kakao.guard';

import {
  GetPlanRoomListResponse,
  GetPlanRoomResponse,
  GetRoomShareCodeResponse,
} from './plan-room.dto';
import { PlanRoomService } from './plan-room.service';
import { PlanUserRequest } from '../plan.type';

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
    @Param('roomId', ParseIntPipe) roomId: number,
  ): Promise<ResponseDataDto<GetPlanRoomResponse>> {
    const result = await this.planRoomService.getPlanRoomInfo(roomId);

    return new ResponseDataDto(result);
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

  @Post(':shareCode([0-9a-fA-F-]{36})')
  @ApiOperation({ summary: '플랜 유저 방 생성' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(PlanApiGuard)
  async postPlanRoom(
    @Request() req: PlanUserRequest,
    @Param('shareCode') shareCode: string,
  ) {
    await this.planRoomService.postPlanRoom(req.user.id, shareCode);
  }
}

import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { ResponseDataDto } from '@app/common/type/response-data';
import { ResponseListDto } from '@app/common/type/response-list';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import {
  GetAdminBrandPromotionEventDetailResponse,
  GetAdminBrandPromotionEventListRequest,
  GetAdminBrandPromotionEventResponse,
  PatchAdminBrandPromotionEventRequest,
  PostAdminBrandPromotionEventRequest,
} from './admin.brand.promotion.event.dto';
import { AdminBrandPromotionEventService } from './admin.brand.promotion.event.service';

@Controller('admin/brand/promotion/event')
export class AdminBrandPromotionEventController {
  constructor(
    private readonly adminBrandPromotionEventService: AdminBrandPromotionEventService,
  ) {}

  @Post()
  @ApiOperation({ summary: '브랜드 프로모션 이벤트 등록' })
  @HttpCode(HttpStatus.CREATED)
  @ResponseException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    '브랜드 프로모션 이벤트 등록 실패',
  )
  async createBrandPromotionEvent(
    @Body() request: PostAdminBrandPromotionEventRequest,
  ) {
    await this.adminBrandPromotionEventService.createBrandPromotionEvent(
      request,
    );
  }

  @Get()
  @ApiOperation({ summary: '브랜드 프로모션 이벤트 리스트 조회' })
  @ResponseList(GetAdminBrandPromotionEventResponse)
  async getBrandPromotionEventList(
    @Query() request: GetAdminBrandPromotionEventListRequest,
  ): Promise<ResponseListDto<GetAdminBrandPromotionEventResponse>> {
    const [result, total] =
      await this.adminBrandPromotionEventService.getBrandPromotionEventList(
        request,
      );
    return new ResponseListDto(result, total);
  }

  @Get(':id(\\d+)')
  @ApiOperation({ summary: '브랜드 프로모션 이벤트 상세 조회' })
  @ResponseData(GetAdminBrandPromotionEventDetailResponse)
  async getBrandPromotionEventDetail(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetAdminBrandPromotionEventDetailResponse>> {
    const result =
      await this.adminBrandPromotionEventService.getBrandPromotionEventDetail(
        id,
      );

    return new ResponseDataDto(result);
  }

  @Patch(':id(\\d+)')
  @ApiOperation({ summary: '브랜드 프로모션 이벤트 수정' })
  @ResponseData(GetAdminBrandPromotionEventDetailResponse)
  async patchBrandPromotionEvent(
    @Param('id', ParseIntPipe) id: number,
    @Body() request: PatchAdminBrandPromotionEventRequest,
  ) {
    await this.adminBrandPromotionEventService.patchBrandPromotionEvent(
      id,
      request,
    );
  }

  @Delete(':id(\\d+)')
  @ApiOperation({ summary: '브랜드 프로모션 이벤트 삭제' })
  @ResponseData(GetAdminBrandPromotionEventDetailResponse)
  async deleteBrandPromotionEvent(@Param('id', ParseIntPipe) id: number) {
    await this.adminBrandPromotionEventService.deleteBrandPromotionEvent(id);
  }
}

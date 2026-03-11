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
  GetAdminBrandPromotionEventCouponListRequest,
  GetAdminBrandPromotionEventCouponResponse,
  GetAdminBrandPromotionEventListRequest,
  GetAdminBrandPromotionEventResponse,
  GetAdminBrandPromotionEventCouponDetailResponse,
  PatchAdminBrandPromotionEventCouponRequest,
  PatchAdminBrandPromotionEventRequest,
  PostAdminBrandPromotionEventRequest,
  PostAdminBrandPromotionEventCouponRequest,
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

  @Post('coupon')
  @ApiOperation({ summary: '브랜드 프로모션 이벤트 쿠폰 등록' })
  @HttpCode(HttpStatus.CREATED)
  @ResponseException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    '브랜드 프로모션 이벤트 쿠폰 등록 실패',
  )
  async createBrandPromotionEventCoupon(
    @Body() request: PostAdminBrandPromotionEventCouponRequest,
  ) {
    await this.adminBrandPromotionEventService.createBrandPromotionEventCoupon(
      request,
    );
  }

  @Get('coupon')
  @ApiOperation({ summary: '브랜드 프로모션 이벤트 쿠폰 리스트 조회' })
  @HttpCode(HttpStatus.OK)
  @ResponseList(GetAdminBrandPromotionEventCouponResponse)
  @ResponseException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    '브랜드 프로모션 이벤트 쿠폰 리스트 조회 실패',
  )
  async getBrandPromotionEventCouponList(
    @Query() request: GetAdminBrandPromotionEventCouponListRequest,
  ): Promise<ResponseListDto<GetAdminBrandPromotionEventCouponResponse>> {
    const [result, total] =
      await this.adminBrandPromotionEventService.getBrandPromotionEventCouponList(
        request,
      );
    return new ResponseListDto(result, total);
  }

  @Get('coupon/:id(\\d+)')
  @ApiOperation({ summary: '브랜드 프로모션 이벤트 쿠폰 상세 조회' })
  @ResponseData(GetAdminBrandPromotionEventCouponDetailResponse)
  @ResponseException(
    HttpStatus.NOT_FOUND,
    '브랜드 프로모션 이벤트 쿠폰이 존재하지 않습니다.',
  )
  async getBrandPromotionEventCouponDetail(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetAdminBrandPromotionEventCouponDetailResponse>> {
    const result =
      await this.adminBrandPromotionEventService.getBrandPromotionEventCouponDetail(
        id,
      );
    return new ResponseDataDto(result);
  }

  @Patch('coupon/:id(\\d+)')
  @ApiOperation({ summary: '브랜드 프로모션 이벤트 쿠폰 수정' })
  @HttpCode(HttpStatus.OK)
  @ResponseException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    '브랜드 프로모션 이벤트 쿠폰 수정 실패',
  )
  async patchBrandPromotionEventCoupon(
    @Param('id', ParseIntPipe) id: number,
    @Body() request: PatchAdminBrandPromotionEventCouponRequest,
  ) {
    await this.adminBrandPromotionEventService.patchBrandPromotionEventCoupon(
      id,
      request,
    );
  }

  @Delete('coupon/:id(\\d+)')
  @ApiOperation({ summary: '브랜드 프로모션 이벤트 쿠폰 삭제' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    '브랜드 프로모션 이벤트 쿠폰 삭제 실패',
  )
  async deleteBrandPromotionEventCoupon(@Param('id', ParseIntPipe) id: number) {
    await this.adminBrandPromotionEventService.deleteBrandPromotionEventCoupon(
      id,
    );
  }
}

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
  GetAdminBrandPromotionNoticeDetailResponse,
  GetAdminBrandPromotionNoticeListRequest,
  GetAdminBrandPromotionNoticeResponse,
  PatchAdminBrandPromotionNoticeRequest,
  PostAdminBrandPromotionNoticeRequest,
} from './admin.brand.promotion.notice.dto';
import { AdminBrandPromotionNoticeService } from './admin.brand.promotion.notice.service';

@Controller('admin/brand/promotion/notice')
export class AdminBrandPromotionNoticeController {
  constructor(
    private readonly adminBrandPromotionNoticeService: AdminBrandPromotionNoticeService,
  ) {}

  @Post()
  @ApiOperation({ summary: '브랜드 프로모션 공지 등록' })
  @HttpCode(HttpStatus.CREATED)
  @ResponseException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    '브랜드 프로모션 공지 등록 실패',
  )
  async createBrandPromotionNotice(
    @Body() request: PostAdminBrandPromotionNoticeRequest,
  ) {
    await this.adminBrandPromotionNoticeService.createBrandPromotionNotice(
      request,
    );
  }

  @Get()
  @ApiOperation({ summary: '브랜드 프로모션 공지 리스트 조회' })
  @ResponseList(GetAdminBrandPromotionNoticeResponse)
  async getBrandPromotionNoticeList(
    @Query() request: GetAdminBrandPromotionNoticeListRequest,
  ): Promise<ResponseListDto<GetAdminBrandPromotionNoticeResponse>> {
    const [result, total] =
      await this.adminBrandPromotionNoticeService.getBrandPromotionNoticeList(
        request,
      );

    return new ResponseListDto(result, total);
  }

  @Get(':id(\\d+)')
  @ApiOperation({ summary: '브랜드 프로모션 공지 상세 조회' })
  @ResponseData(GetAdminBrandPromotionNoticeDetailResponse)
  @ResponseException(
    HttpStatus.NOT_FOUND,
    '브랜드 프로모션 공지가 존재하지 않습니다.',
  )
  async getBrandPromotionNoticeDetail(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetAdminBrandPromotionNoticeDetailResponse>> {
    const result =
      await this.adminBrandPromotionNoticeService.getBrandPromotionNoticeDetail(
        id,
      );

    return new ResponseDataDto(result);
  }

  @Patch(':id(\\d+)')
  @ApiOperation({ summary: '브랜드 프로모션 공지 수정' })
  @HttpCode(HttpStatus.OK)
  @ResponseException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    '브랜드 프로모션 공지 수정 실패',
  )
  async updateBrandPromotionNotice(
    @Param('id', ParseIntPipe) id: number,
    @Body() request: PatchAdminBrandPromotionNoticeRequest,
  ) {
    await this.adminBrandPromotionNoticeService.patchBrandPromotionNotice(
      id,
      request,
    );
  }

  @Delete(':id(\\d+)')
  @ApiOperation({ summary: '브랜드 프로모션 공지 삭제' })
  @HttpCode(HttpStatus.OK)
  @ResponseException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    '브랜드 프로모션 공지 삭제 실패',
  )
  async deleteBrandPromotionNotice(@Param('id', ParseIntPipe) id: number) {
    await this.adminBrandPromotionNoticeService.deleteBrandPromotionNotice(id);
  }
}

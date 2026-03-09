import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { ResponseDataDto } from '@app/common/type/response-data';
import { ResponseListDto } from '@app/common/type/response-list';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import {
  GetAdminBrandPromotionPopupDetailResponse,
  GetAdminBrandPromotionPopupListRequest,
  GetAdminBrandPromotionPopupResponse,
  PostAdminBrandPromotionPopupRequest,
} from './admin.brand.promotion.popup.dto';
import { AdminBrandPromotionPopupService } from './admin.brand.promotion.popup.service';

@Controller('admin/brand/promotion/popup')
export class AdminBrandPromotionPopupController {
  constructor(
    private readonly adminBrandPromotionPopupService: AdminBrandPromotionPopupService,
  ) {}

  @Post()
  @ApiOperation({ summary: '브랜드 프로모션 팝업 등록' })
  @HttpCode(HttpStatus.CREATED)
  @ResponseException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    '브랜드 프로모션 팝업 등록 실패',
  )
  async createBrandPromotionPopup(
    @Body() request: PostAdminBrandPromotionPopupRequest,
  ) {
    await this.adminBrandPromotionPopupService.createBrandPromotionPopup(
      request,
    );
  }

  @Get()
  @ApiOperation({ summary: '브랜드 프로모션 팝업 리스트 조회' })
  @ResponseList(GetAdminBrandPromotionPopupResponse)
  async getBrandPromotionPopupList(
    @Query() request: GetAdminBrandPromotionPopupListRequest,
  ): Promise<ResponseListDto<GetAdminBrandPromotionPopupResponse>> {
    const [result, total] =
      await this.adminBrandPromotionPopupService.getBrandPromotionPopupList(
        request,
      );
    return new ResponseListDto(result, total);
  }

  @Get(':id(\\d+)')
  @ApiOperation({ summary: '브랜드 프로모션 팝업 상세 조회' })
  @ResponseData(GetAdminBrandPromotionPopupDetailResponse)
  async getBrandPromotionPopupDetail(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetAdminBrandPromotionPopupDetailResponse>> {
    const result =
      await this.adminBrandPromotionPopupService.getBrandPromotionPopupDetail(
        id,
      );

    return new ResponseDataDto(result);
  }
}

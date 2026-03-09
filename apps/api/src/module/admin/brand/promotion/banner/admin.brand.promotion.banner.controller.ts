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
  GetAdminBrandPromotionBannerDetailResponse,
  GetAdminBrandPromotionBannerRequest,
  GetAdminBrandPromotionBannerResponse,
  PatchAdminBrandPromotionBannerRequest,
  PostAdminBrandPromotionBannerRequest,
} from './admin.brand.promotion.banner.dto';
import { AdminBrandPromotionBannerService } from './admin.brand.promotion.banner.service';

@Controller('admin/brand/promotion/banner')
export class AdminBrandPromotionBannerController {
  constructor(
    private readonly adminBrandPromotionBannerService: AdminBrandPromotionBannerService,
  ) {}

  @Post()
  @ApiOperation({ summary: '브랜드 프로모션 배너 등록' })
  @HttpCode(HttpStatus.CREATED)
  @ResponseException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    '브랜드 프로모션 배너 등록 실패',
  )
  async createBrandPromotionBanner(
    @Body() request: PostAdminBrandPromotionBannerRequest,
  ) {
    await this.adminBrandPromotionBannerService.createBrandPromotionBanner(
      request,
    );
  }

  @Get()
  @ApiOperation({ summary: '브랜드 프로모션 배너 리스트 조회' })
  @ResponseList(GetAdminBrandPromotionBannerResponse)
  async getBrandPromotionBannerList(
    @Query() request: GetAdminBrandPromotionBannerRequest,
  ): Promise<ResponseListDto<GetAdminBrandPromotionBannerResponse>> {
    const [result, total] =
      await this.adminBrandPromotionBannerService.getBrandPromotionBannerList(
        request,
      );
    return new ResponseListDto(result, total);
  }

  @Get(':id(\\d+)')
  @ApiOperation({ summary: '브랜드 프로모션 배너 상세 조회' })
  @ResponseData(GetAdminBrandPromotionBannerDetailResponse)
  async getBrandPromotionBannerDetail(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetAdminBrandPromotionBannerDetailResponse>> {
    const result =
      await this.adminBrandPromotionBannerService.getBrandPromotionBannerDetail(
        id,
      );

    return new ResponseDataDto(result);
  }

  @Patch(':id(\\d+)')
  @ApiOperation({ summary: '브랜드 프로모션 배너 수정' })
  @HttpCode(HttpStatus.OK)
  @ResponseException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    '브랜드 프로모션 배너 수정 실패',
  )
  async patchBrandPromotionBanner(
    @Param('id', ParseIntPipe) id: number,
    @Body() request: PatchAdminBrandPromotionBannerRequest,
  ) {
    await this.adminBrandPromotionBannerService.patchBrandPromotionBanner(
      id,
      request,
    );
  }

  @Delete(':id(\\d+)')
  @ApiOperation({ summary: '브랜드 프로모션 배너 삭제' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    '브랜드 프로모션 배너 삭제 실패',
  )
  async deleteBrandPromotionBanner(@Param('id', ParseIntPipe) id: number) {
    await this.adminBrandPromotionBannerService.deleteBrandPromotionBanner(id);
  }
}

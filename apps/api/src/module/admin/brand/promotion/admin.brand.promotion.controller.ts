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
  GetAdminBrandPromotionDetailResponse,
  GetAdminBrandPromotionListRequest,
  GetAdminBrandPromotionResponse,
  PatchAdminBrandPromotionRequest,
  PostAdminBrandPromotionRequest,
} from './admin.brand.promotion.dto';
import { AdminBrandPromotionService } from './admin.brand.promotion.service';

@Controller('admin/brand/promotion')
export class AdminBrandPromotionController {
  constructor(
    private readonly adminBrandPromotionService: AdminBrandPromotionService,
  ) {}

  @Post()
  @ApiOperation({ summary: '브랜드 프로모션 등록' })
  @HttpCode(HttpStatus.CREATED)
  @ResponseException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    '브랜드 프로모션 등록 실패',
  )
  async createBrandPromotion(@Body() request: PostAdminBrandPromotionRequest) {
    await this.adminBrandPromotionService.createBrandPromotion(request);
  }

  @Get()
  @ApiOperation({ summary: '브랜드 프로모션 리스트 조회' })
  @ResponseList(GetAdminBrandPromotionResponse)
  async getBrandPromotionList(
    @Query() request: GetAdminBrandPromotionListRequest,
  ): Promise<ResponseListDto<GetAdminBrandPromotionResponse>> {
    const [result, total] =
      await this.adminBrandPromotionService.getBrandPromotionList(request);
    return new ResponseListDto(result, total);
  }

  @Get(':id(\\d+)')
  @ApiOperation({ summary: '브랜드 프로모션 상세 조회' })
  @ResponseData(GetAdminBrandPromotionDetailResponse)
  @ResponseException(
    HttpStatus.NOT_FOUND,
    '브랜드 프로모션이 존재하지 않습니다.',
  )
  async getBrandPromotionDetail(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetAdminBrandPromotionDetailResponse>> {
    const result =
      await this.adminBrandPromotionService.getBrandPromotionDetail(id);

    return new ResponseDataDto(result);
  }

  @Patch(':id(\\d+)')
  @ApiOperation({ summary: '브랜드 프로모션 수정' })
  @HttpCode(HttpStatus.OK)
  @ResponseException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    '브랜드 프로모션 수정 실패',
  )
  async updateBrandPromotion(
    @Param('id', ParseIntPipe) id: number,
    @Body() request: PatchAdminBrandPromotionRequest,
  ) {
    await this.adminBrandPromotionService.updateBrandPromotion(id, request);
  }

  @Delete(':id(\\d+)')
  @ApiOperation({ summary: '브랜드 프로모션 삭제' })
  @HttpCode(HttpStatus.OK)
  @ResponseException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    '브랜드 프로모션 삭제 실패',
  )
  async deleteBrandPromotion(@Param('id', ParseIntPipe) id: number) {
    await this.adminBrandPromotionService.deleteBrandPromotion(id);
  }
}

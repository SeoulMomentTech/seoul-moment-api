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
  GetAdminBrandPromotionNoticsDetailResponse,
  GetAdminBrandPromotionNoticsListRequest,
  GetAdminBrandPromotionNoticsResponse,
  PatchAdminBrandPromotionNoticsRequest,
  PostAdminBrandPromotionNoticsRequest,
} from './admin.brand.promotion.notics.dto';
import { AdminBrandPromotionNoticsService } from './admin.brand.promotion.notics.service';

@Controller('admin/brand/promotion/notics')
export class AdminBrandPromotionNoticsController {
  constructor(
    private readonly adminBrandPromotionNoticsService: AdminBrandPromotionNoticsService,
  ) {}

  @Post()
  @ApiOperation({ summary: '브랜드 프로모션 공지 등록' })
  @HttpCode(HttpStatus.CREATED)
  @ResponseException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    '브랜드 프로모션 공지 등록 실패',
  )
  async createBrandPromotionNotics(
    @Body() request: PostAdminBrandPromotionNoticsRequest,
  ) {
    await this.adminBrandPromotionNoticsService.createBrandPromotionNotics(
      request,
    );
  }

  @Get()
  @ApiOperation({ summary: '브랜드 프로모션 공지 리스트 조회' })
  @ResponseList(GetAdminBrandPromotionNoticsResponse)
  async getBrandPromotionNoticsList(
    @Query() request: GetAdminBrandPromotionNoticsListRequest,
  ): Promise<ResponseListDto<GetAdminBrandPromotionNoticsResponse>> {
    const [result, total] =
      await this.adminBrandPromotionNoticsService.getBrandPromotionNoticsList(
        request,
      );

    return new ResponseListDto(result, total);
  }

  @Get(':id(\\d+)')
  @ApiOperation({ summary: '브랜드 프로모션 공지 상세 조회' })
  @ResponseData(GetAdminBrandPromotionNoticsDetailResponse)
  @ResponseException(
    HttpStatus.NOT_FOUND,
    '브랜드 프로모션 공지가 존재하지 않습니다.',
  )
  async getBrandPromotionNoticsDetail(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetAdminBrandPromotionNoticsDetailResponse>> {
    const result =
      await this.adminBrandPromotionNoticsService.getBrandPromotionNoticsDetail(
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
  async updateBrandPromotionNotics(
    @Param('id', ParseIntPipe) id: number,
    @Body() request: PatchAdminBrandPromotionNoticsRequest,
  ) {
    await this.adminBrandPromotionNoticsService.patchBrandPromotionNotics(
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
  async deleteBrandPromotionNotics(@Param('id', ParseIntPipe) id: number) {
    await this.adminBrandPromotionNoticsService.deleteBrandPromotionNotics(id);
  }
}

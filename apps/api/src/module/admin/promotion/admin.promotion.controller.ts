/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { ResponseDataDto } from '@app/common/type/response-data';
import { ResponseListDto } from '@app/common/type/response-list';
import { LanguageCode } from '@app/repository/enum/language.enum';
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
  GetAdminPromotionDetailResponse,
  GetAdminPromotionListRequest,
  GetAdminPromotionResponse,
  PatchAdminPromotionRequest,
  PostAdminPromotionRequest,
} from './admin.promotion.dto';
import { AdminPromotionService } from './admin.promotion.service';

@Controller('admin/promotion')
export class AdminPromotionController {
  constructor(private readonly adminPromotionService: AdminPromotionService) {}

  @Post()
  @ApiOperation({ summary: '프로모션 등록' })
  @HttpCode(HttpStatus.CREATED)
  @ResponseException(HttpStatus.INTERNAL_SERVER_ERROR, '프로모션 등록 실패')
  async createPromotion(@Body() request: PostAdminPromotionRequest) {
    await this.adminPromotionService.createPromotion(request);
  }

  @Get()
  @ApiOperation({ summary: '프로모션 리스트 조회' })
  @ResponseList(GetAdminPromotionResponse)
  async getPromotionList(
    @Query() request: GetAdminPromotionListRequest,
  ): Promise<ResponseListDto<GetAdminPromotionResponse>> {
    const [result, total] =
      await this.adminPromotionService.getPromotionList(request);

    return new ResponseListDto(result, total);
  }

  @Get(':id(\\d+)')
  @ApiOperation({ summary: '프로모션 상세 조회' })
  @ResponseData(GetAdminPromotionDetailResponse)
  async getPromotionDetail(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetAdminPromotionDetailResponse>> {
    const result = await this.adminPromotionService.getPromotionDetail(id);

    return new ResponseDataDto(result);
  }

  @Patch(':id(\\d+)')
  @ApiOperation({ summary: '프로모션 수정' })
  @HttpCode(HttpStatus.OK)
  @ResponseException(HttpStatus.INTERNAL_SERVER_ERROR, '프로모션 수정 실패')
  async updatePromotion(
    @Param('id', ParseIntPipe) id: number,
    @Body() request: PatchAdminPromotionRequest,
  ) {
    await this.adminPromotionService.updatePromotion(id, request);
  }

  @Delete(':id(\\d+)')
  @ApiOperation({ summary: '프로모션 삭제' })
  @HttpCode(HttpStatus.OK)
  @ResponseException(HttpStatus.INTERNAL_SERVER_ERROR, '프로모션 삭제 실패')
  async deletePromotion(@Param('id', ParseIntPipe) id: number) {
    await this.adminPromotionService.deletePromotion(id);
  }
}

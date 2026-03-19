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
  GetAdminPromotionResponse,
  PatchAdminPromotionRequest,
  PostAdminPromotionRequest,
} from './promotion.dto';
import { AdminPromotionService } from './promotion.service';
import { GetAdminBrandPromotionListRequest } from '../brand/promotion/admin.brand.promotion.dto';

@Controller('admin/promotion')
export class AdminPromotionController {
  private readonly MOCK_PROMOTION_LIST: GetAdminPromotionResponse[] = [
    {
      id: 1,
      startDate: new Date(),
      endDate: new Date(),
      isActive: true,
      language: [
        {
          languageCode: LanguageCode.KOREAN,
          title: '제목',
          description: '설명',
        },
      ],
      createDate: new Date(),
      updateDate: new Date(),
      bannerImageUrl:
        'https://image-dev.seoulmoment.com.tw/promotions/2025-09-16/promotion-01.jpg',
      bannerMobileImageUrl:
        'https://image-dev.seoulmoment.com.tw/promotions/2025-09-16/promotion-01.jpg',
      thumbnailImageUrl:
        'https://image-dev.seoulmoment.com.tw/promotions/2025-09-16/promotion-01.jpg',
    },
  ];

  private readonly MOCK_PROMOTION_DETAIL: GetAdminPromotionDetailResponse = {
    id: 1,
    startDate: new Date(),
    endDate: new Date(),
    isActive: true,
    language: [
      {
        languageCode: LanguageCode.KOREAN,
        title: '제목',
        description: '설명',
      },
    ],
    createDate: new Date(),
    updateDate: new Date(),
    bannerImageUrl:
      'https://image-dev.seoulmoment.com.tw/promotions/2025-09-16/promotion-01.jpg',
    bannerMobileImageUrl:
      'https://image-dev.seoulmoment.com.tw/promotions/2025-09-16/promotion-01.jpg',
    thumbnailImageUrl:
      'https://image-dev.seoulmoment.com.tw/promotions/2025-09-16/promotion-01.jpg',
  };

  constructor(private readonly adminPromotionService: AdminPromotionService) {}

  @Post()
  @ApiOperation({ summary: '프로모션 등록' })
  @HttpCode(HttpStatus.CREATED)
  @ResponseException(HttpStatus.INTERNAL_SERVER_ERROR, '프로모션 등록 실패')
  async createPromotion(@Body() request: PostAdminPromotionRequest) {}

  @Get()
  @ApiOperation({ summary: '프로모션 리스트 조회' })
  @ResponseList(GetAdminPromotionResponse)
  async getPromotionList(
    @Query() request: GetAdminBrandPromotionListRequest,
  ): Promise<ResponseListDto<GetAdminPromotionResponse>> {
    return new ResponseListDto(
      this.MOCK_PROMOTION_LIST,
      this.MOCK_PROMOTION_LIST.length,
    );
  }

  @Get(':id(\\d+)')
  @ApiOperation({ summary: '프로모션 상세 조회' })
  @ResponseData(GetAdminPromotionDetailResponse)
  async getPromotionDetail(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetAdminPromotionDetailResponse>> {
    return new ResponseDataDto(this.MOCK_PROMOTION_DETAIL);
  }

  @Patch(':id(\\d+)')
  @ApiOperation({ summary: '프로모션 수정' })
  @HttpCode(HttpStatus.OK)
  @ResponseException(HttpStatus.INTERNAL_SERVER_ERROR, '프로모션 수정 실패')
  async updatePromotion(
    @Param('id', ParseIntPipe) id: number,
    @Body() request: PatchAdminPromotionRequest,
  ) {}

  @Delete(':id(\\d+)')
  @ApiOperation({ summary: '프로모션 삭제' })
  @HttpCode(HttpStatus.OK)
  @ResponseException(HttpStatus.INTERNAL_SERVER_ERROR, '프로모션 삭제 실패')
  async deletePromotion(@Param('id', ParseIntPipe) id: number) {}
}

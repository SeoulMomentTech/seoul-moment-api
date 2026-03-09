import { ResponseData } from '@app/common/decorator/response-data.decorator';
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
  GetAdminBrandPromotionSectionDetailResponse,
  GetAdminBrandPromotionSectionListRequest,
  GetAdminBrandPromotionSectionResponse,
  GetAdminBrandPromotionSectionTypeResponse,
  PatchAdminBrandPromotionSectionRequest,
  PostAdminBrandPromotionSectionRequest,
} from './admin.brand.promotion.section.dto';
import { AdminBrandPromotionSectionService } from './admin.brand.promotion.section.service';

@Controller('admin/brand/promotion/section')
export class AdminBrandPromotionSectionController {
  constructor(
    private readonly adminBrandPromotionSectionService: AdminBrandPromotionSectionService,
  ) {}

  @Get('type')
  @ApiOperation({ summary: '브랜드 프로모션 섹션 타입 리스트 조회' })
  @ResponseList(GetAdminBrandPromotionSectionTypeResponse)
  async getBrandPromotionSectionTypeList(): Promise<
    ResponseListDto<GetAdminBrandPromotionSectionTypeResponse>
  > {
    const result =
      await this.adminBrandPromotionSectionService.getBrandPromotionSectionTypeList();
    return new ResponseListDto(result);
  }

  @Post()
  @ApiOperation({ summary: '브랜드 프로모션 섹션 등록' })
  @HttpCode(HttpStatus.CREATED)
  async createBrandPromotionSection(
    @Body() request: PostAdminBrandPromotionSectionRequest,
  ) {
    await this.adminBrandPromotionSectionService.createBrandPromotionSection(
      request,
    );
  }

  @Get()
  @ApiOperation({ summary: '브랜드 프로모션 섹션 리스트 조회' })
  @ResponseList(GetAdminBrandPromotionSectionResponse)
  async getBrandPromotionSectionList(
    @Query() request: GetAdminBrandPromotionSectionListRequest,
  ): Promise<ResponseListDto<GetAdminBrandPromotionSectionResponse>> {
    const [result, total] =
      await this.adminBrandPromotionSectionService.getBrandPromotionSectionList(
        request,
      );

    return new ResponseListDto(result, total);
  }

  @Get(':id(\\d+)')
  @ApiOperation({ summary: '브랜드 프로모션 섹션 상세 조회' })
  @ResponseData(GetAdminBrandPromotionSectionDetailResponse)
  async getBrandPromotionSectionDetail(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetAdminBrandPromotionSectionDetailResponse>> {
    const result =
      await this.adminBrandPromotionSectionService.getBrandPromotionSectionDetail(
        id,
      );

    return new ResponseDataDto(result);
  }

  @Patch(':id(\\d+)')
  @ApiOperation({ summary: '브랜드 프로모션 섹션 수정' })
  @HttpCode(HttpStatus.OK)
  async updateBrandPromotionSection(
    @Param('id', ParseIntPipe) id: number,
    @Body() request: PatchAdminBrandPromotionSectionRequest,
  ): Promise<void> {
    await this.adminBrandPromotionSectionService.updateBrandPromotionSection(
      id,
      request,
    );
  }

  @Delete(':id(\\d+)')
  @ApiOperation({ summary: '브랜드 프로모션 섹션 삭제' })
  @HttpCode(HttpStatus.OK)
  async deleteBrandPromotionSection(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.adminBrandPromotionSectionService.deleteBrandPromotionSection(
      id,
    );
  }
}

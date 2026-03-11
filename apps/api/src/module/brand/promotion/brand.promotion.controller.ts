import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { ResponseDataDto } from '@app/common/type/response-data';
import { ResponseListDto } from '@app/common/type/response-list';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { Controller, Get, Headers, Param, ParseIntPipe } from '@nestjs/common';
import { ApiHeader, ApiOperation } from '@nestjs/swagger';

import {
  GetBrandPromotionBrandResponse,
  GetBrandPromotionResponse,
} from './brand.promotion.dto';
import { BrandPromotionService } from './brand.promotion.service';

@Controller('brand/promotion')
export class BrandPromotionController {
  constructor(
    private readonly brandPromotionService: BrandPromotionService,
    private readonly productRepositoryService: ProductRepositoryService,
  ) {}

  @Get('brand')
  @ApiOperation({ summary: '브랜드 프로모션 리스트 조회' })
  @ResponseList(GetBrandPromotionBrandResponse)
  async getBrandPromotionList(): Promise<
    ResponseListDto<GetBrandPromotionBrandResponse>
  > {
    const result = await this.brandPromotionService.getBrandPromotionList();

    return new ResponseListDto(result);
  }

  @Get(':brandId(\\d+)')
  @ApiOperation({ summary: '브랜드 프로모션 상세 조회' })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description:
      'Alternative way to specify language preference (ko, en, zh-TW)',
    enum: LanguageCode,
  })
  @ResponseData(GetBrandPromotionResponse)
  async getBrandPromotionDetail(
    @Headers('Accept-language') acceptLanguage: LanguageCode,
    @Param('brandId', ParseIntPipe) brandId: number,
  ): Promise<ResponseDataDto<GetBrandPromotionResponse>> {
    const result = await this.brandPromotionService.getBrandPromotionDetail(
      brandId,
      acceptLanguage,
    );

    return new ResponseDataDto(result);
  }
}

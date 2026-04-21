import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseDataDto } from '@app/common/type/response-data';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { Controller, Get, Headers, Param, ParseIntPipe } from '@nestjs/common';
import { ApiHeader, ApiOperation } from '@nestjs/swagger';

import { GetBrandPromotionResponse } from '../brand.promotion.dto';
import { BrandPromotionService } from '../brand.promotion.service';

@Controller('brand/promotion/v1')
export class V1BrandPromotionController {
  constructor(private readonly brandPromotionService: BrandPromotionService) {}

  @Get(':brandPromotionId(\\d+)')
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
    @Param('brandPromotionId', ParseIntPipe) brandPromotionId: number,
  ): Promise<ResponseDataDto<GetBrandPromotionResponse>> {
    const result = await this.brandPromotionService.v1GetBrandPromotionDetail(
      brandPromotionId,
      acceptLanguage,
    );

    return new ResponseDataDto(result);
  }
}

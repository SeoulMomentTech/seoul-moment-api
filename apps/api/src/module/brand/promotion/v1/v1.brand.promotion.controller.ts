import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation } from '@nestjs/swagger';

import { OptionalUserId } from '../../../../decorator/optional-user.decorator';
import { OptionalUserGuard } from '../../../../guard/optional-user.guard';
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
  @ApiHeader({
    name: 'Authorization',
    required: false,
    description:
      'JWT token 이곳에 토큰을 쓰지 말고 실제 사용은 swagger 자물쇠를 사용',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(OptionalUserGuard)
  @ResponseData(GetBrandPromotionResponse)
  async getBrandPromotionDetail(
    @Headers('Accept-language') acceptLanguage: LanguageCode,
    @OptionalUserId() userId: number | undefined,
    @Param('brandPromotionId', ParseIntPipe) brandPromotionId: number,
  ): Promise<ResponseDataDto<GetBrandPromotionResponse>> {
    const result = await this.brandPromotionService.v1GetBrandPromotionDetail(
      brandPromotionId,
      acceptLanguage,
      userId,
    );

    return new ResponseDataDto(result);
  }
}

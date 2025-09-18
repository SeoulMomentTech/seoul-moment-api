import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { ResponseListDto } from '@app/common/type/response-list';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { Controller, Get, Headers, Query } from '@nestjs/common';
import { ApiHeader, ApiOperation } from '@nestjs/swagger';

import {
  GetPartnerCategoryResponse,
  GetPartnerRequest,
  GetPartnerResponse,
} from './partner.dto';
import { PartnerService } from './partner.service';

@Controller('partner')
export class PartnerController {
  constructor(private readonly partnerService: PartnerService) {}

  @Get()
  @ApiOperation({
    summary: 'Get partner list by category with Multilingual Support',
    description:
      'Returns partner list by category in the specified language. Supports Korean (ko), English (en), and Chinese (zh).',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ResponseList(GetPartnerResponse)
  async getPartner(
    @Headers('Accept-language') acceptLanguage: LanguageCode,
    @Query() query: GetPartnerRequest,
  ): Promise<ResponseListDto<GetPartnerResponse>> {
    const result = await this.partnerService.getPartner(
      query.partnerCategoryId,
      query.country,
      acceptLanguage,
    );

    return new ResponseListDto(result);
  }

  @Get('category')
  @ApiOperation({
    summary: 'Get partner category list with Multilingual Support',
    description:
      'Returns partner category list in the specified language. Supports Korean (ko), English (en), and Chinese (zh).',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ResponseList(GetPartnerCategoryResponse)
  async getPartnerCategory(
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): Promise<ResponseListDto<GetPartnerCategoryResponse>> {
    const result = await this.partnerService.getPartnerCategory(acceptLanguage);

    return new ResponseListDto(result);
  }
}

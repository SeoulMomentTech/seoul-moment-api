import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseDataDto } from '@app/common/type/response-data';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiOperation, ApiHeader } from '@nestjs/swagger';

import { GetBrandIntroduceResponse } from './brand.dto';
import { BrandService } from './brand.service';

@Controller('brand')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Get Brand Introduce with Multilingual Support',
    description:
      'Returns brand information in the specified language. Supports Korean (ko), English (en), and Chinese (zh).',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ResponseData(GetBrandIntroduceResponse)
  @ResponseException(HttpStatus.NOT_FOUND, '존재하는 브랜드가 없음')
  async getBrandIntroduce(
    @Param('id', ParseIntPipe) id: number,
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): Promise<ResponseDataDto<GetBrandIntroduceResponse>> {
    const result = await this.brandService.getBrandIntroduce(
      id,
      acceptLanguage,
    );
    return new ResponseDataDto(result);
  }
}

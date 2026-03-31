import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseDataDto } from '@app/common/type/response-data';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { BadRequestException, Controller, Get, Headers } from '@nestjs/common';
import { ApiHeader, ApiOperation } from '@nestjs/swagger';

import { HomeService } from '../home.service';
import { V1GetHomeResponse } from './home.v1.dto';

@Controller('home/v1')
export class HomeV1Controller {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  @ApiOperation({
    summary: 'Get Home with Multilingual Support V1',
    description:
      'Returns home information in the specified language. Supports Korean (ko), English (en), and Chinese (zh).',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ResponseData(V1GetHomeResponse)
  async v1GetHome(
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): Promise<ResponseDataDto<V1GetHomeResponse>> {
    if (
      !acceptLanguage ||
      !Object.values(LanguageCode).includes(acceptLanguage)
    ) {
      throw new BadRequestException(
        `Accept-language header is required and must be one of: ${Object.values(LanguageCode).join(', ')}`,
      );
    }

    const result = await this.homeService.v1GetHome(acceptLanguage);
    return new ResponseDataDto(result);
  }
}

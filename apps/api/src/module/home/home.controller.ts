import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseDataDto } from '@app/common/type/response-data';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { BadRequestException, Controller, Get, Headers } from '@nestjs/common';
import { ApiHeader, ApiOperation } from '@nestjs/swagger';

import { GetHomeResponse } from './home.dto';
import { HomeService } from './home.service';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  @ApiOperation({
    summary: 'Get Home with Multilingual Support',
    description:
      'Returns home information in the specified language. Supports Korean (ko), English (en), and Chinese (zh).',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ResponseData(GetHomeResponse)
  async getBrandIntroduce(
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): Promise<ResponseDataDto<GetHomeResponse>> {
    if (
      !acceptLanguage ||
      !Object.values(LanguageCode).includes(acceptLanguage)
    ) {
      throw new BadRequestException(
        `Accept-language header is required and must be one of: ${Object.values(LanguageCode).join(', ')}`,
      );
    }

    const result = await this.homeService.getHome(acceptLanguage);
    return new ResponseDataDto(result);
  }
}

import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { ResponseDataDto } from '@app/common/type/response-data';
import { ResponseListDto } from '@app/common/type/response-list';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiHeader } from '@nestjs/swagger';

import {
  GetBrandIntroduceResponse,
  GetBrandListByNameFilterTypeRequest,
  GetBrandListByNameResponse,
  PostBrandRequest,
} from './brand.dto';
import { BrandService } from './brand.service';

@Controller('brand')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get('/list/filter')
  @ApiOperation({
    summary: 'Get Brand List',
    description:
      'Returns brand list of brand names in English. Available filters: A_TO_D, E_TO_H, I_TO_L, M_TO_P, Q_TO_T, U_TO_Z, NUMBER_SYMBOL.',
  })
  @ResponseList(GetBrandListByNameResponse)
  async getBrandListByName(
    @Query() query: GetBrandListByNameFilterTypeRequest,
  ): Promise<ResponseListDto<GetBrandListByNameResponse>> {
    const result = await this.brandService.getBrandListByName(query.categoryId);
    return new ResponseListDto(result);
  }

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

  @Post()
  @ApiOperation({
    summary: '브랜드 다국어 등록',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async postBrand(@Body() body: PostBrandRequest) {
    await this.brandService.postBrand(body);
  }
}

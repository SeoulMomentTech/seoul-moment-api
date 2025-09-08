import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { ResponseListDto } from '@app/common/type/response-list';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { Controller, Get, Headers } from '@nestjs/common';
import { ApiHeader, ApiOperation } from '@nestjs/swagger';

import {
  GetProductBannerResponse,
  GetProductCategoryResponse,
} from './product.dto';
import { ProductService } from './product.service';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get('banner')
  @ApiOperation({
    summary: 'Product banner list',
  })
  @ResponseList(GetProductBannerResponse)
  async getProductBanner(): Promise<ResponseListDto<GetProductBannerResponse>> {
    const result = await this.productService.getProductBanner();

    return new ResponseListDto(result);
  }

  @Get('category')
  @ApiOperation({
    summary: 'Product category list with Multilingual Support',
    description:
      'Returns categories in the specified language. Supports Korean (ko), English (en), and Chinese (zh).',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ResponseList(GetProductCategoryResponse)
  async getProductCategory(
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): Promise<ResponseListDto<GetProductCategoryResponse>> {
    const result = await this.productService.getProductCategory(acceptLanguage);

    return new ResponseListDto(result);
  }
}

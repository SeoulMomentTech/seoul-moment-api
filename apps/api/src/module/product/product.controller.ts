import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { ResponseDataDto } from '@app/common/type/response-data';
import { ResponseListDto } from '@app/common/type/response-list';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiHeader, ApiOperation } from '@nestjs/swagger';

import {
  GetProductBannerResponse,
  GetProductCategoryRequest,
  GetProductCategoryResponse,
  GetProductDetailResponse,
  GetProductRequest,
  GetProductResponse,
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
    @Query() query: GetProductCategoryRequest,
  ): Promise<ResponseListDto<GetProductCategoryResponse>> {
    const result = await this.productService.getProductCategory(
      query.categoryId,
      acceptLanguage,
    );

    return new ResponseListDto(result);
  }

  @Get()
  @ApiOperation({
    summary: 'Product list with Multilingual Support',
    description:
      'Returns product in the specified language. Supports Korean (ko), English (en), and Chinese (zh).',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ResponseList(GetProductResponse)
  async getProduct(
    @Headers('Accept-language') acceptLanguage: LanguageCode,
    @Query() query: GetProductRequest,
  ): Promise<ResponseListDto<GetProductResponse>> {
    const [result, count] = await this.productService.getProduct(
      GetProductRequest.from(
        query.page,
        query.count,
        query.sortColum,
        query.sort,
        query.search,
        query.brandId,
        query.categoryId,
        query.productCategoryId,
      ),
      acceptLanguage,
    );
    return new ResponseListDto(result, count);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Product detail with Multilingual Support',
    description:
      'Returns product detail in the specified language. Supports Korean (ko), English (en), and Chinese (zh).',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ResponseData(GetProductDetailResponse)
  @ResponseException(HttpStatus.NOT_FOUND, '상품이 존재하지 않습니다.')
  async getProductDetail(
    @Headers('Accept-language') acceptLanguage: LanguageCode,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetProductDetailResponse>> {
    const result = await this.productService.getProductDetail(
      id,
      acceptLanguage,
    );

    return new ResponseDataDto(result);
  }
}

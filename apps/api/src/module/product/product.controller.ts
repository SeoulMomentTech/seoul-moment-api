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
import { ApiHeader, ApiOperation } from '@nestjs/swagger';

import {
  GetProductBannerByBrandResponse,
  GetProductBannerRequest,
  GetProductBannerResponse,
  GetProductCategoryRequest,
  GetProductCategoryResponse,
  GetProductDetailResponse,
  GetProductSortFilterResponse,
  GetProductOptionResponse,
  GetProductOptionValueRequest,
  GetProductOptionValueResponse,
  GetProductRequest,
  GetProductResponse,
  PostProductRequest,
  GetProductFilterResponse,
  GetProductFilterRequest,
  PostProductCategoryRequest,
  PostOptionRequest,
  PostProductItemRequest,
  PostOptionValueRequest,
  PostProductVariantRequest,
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

  @Get('banner/brand')
  @ApiOperation({
    summary: 'Product banner list by brand',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ResponseData(GetProductBannerByBrandResponse)
  async getProductBannerByBrand(
    @Headers('Accept-language') acceptLanguage: LanguageCode,
    @Query() query: GetProductBannerRequest,
  ): Promise<ResponseDataDto<GetProductBannerByBrandResponse>> {
    const result = await this.productService.getProductBannerByBrand(
      query.brandId,
      acceptLanguage,
    );
    return new ResponseDataDto(result);
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
    @Query() query: GetProductCategoryRequest,
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): Promise<ResponseListDto<GetProductCategoryResponse>> {
    const result = await this.productService.getProductCategory(
      query.categoryId,
      acceptLanguage,
    );

    return new ResponseListDto(result);
  }

  @Get('option')
  @ApiOperation({
    summary: '상품 옵션 리스트',
  })
  @ResponseList(GetProductOptionResponse)
  async getProductOption(): Promise<ResponseListDto<GetProductOptionResponse>> {
    const result = await this.productService.getOption();

    return new ResponseListDto(result);
  }

  @Get('option/value')
  @ApiOperation({
    summary: '상품 옵션 값 리스트',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ResponseList(GetProductOptionValueResponse)
  async getProductValueOption(
    @Query() query: GetProductOptionValueRequest,
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): Promise<ResponseListDto<GetProductOptionValueResponse>> {
    const result = await this.productService.getOptionValue(
      query.optionId,
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
        query.sortColumn,
        query.sort,
        query.search,
        query.brandId,
        query.categoryId,
        query.productCategoryId,
        query.optionIdList,
        query.mainView,
      ),
      acceptLanguage,
    );
    return new ResponseListDto(result, count);
  }

  @Post()
  @ApiOperation({
    summary: `
      상품 대주제 등록 
      ex) 나이키 아이다스 저지, 나이키 에어포스 등등
    `,
    description: `
      이 등록은 실제 상품 LIST 에 나오는 것이 아닌 상품 대주제를 등록하는 것입니다.
      ex) 나이키 아이다스 저지, 나이키 에어포스 등등
    `,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async postProduct(@Body() body: PostProductRequest) {
    await this.productService.postProduct(body);
  }

  @Get('sort/filter')
  @ApiOperation({
    summary: 'Product sort filter list',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ResponseList(GetProductSortFilterResponse)
  async getProductSortFilter(
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): Promise<ResponseListDto<GetProductSortFilterResponse>> {
    const result =
      await this.productService.getProductSortFilter(acceptLanguage);
    return new ResponseListDto(result);
  }

  @Get('filter')
  @ApiOperation({
    summary: 'Product filter list',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ResponseList(GetProductFilterResponse)
  async getProductFilter(
    @Headers('Accept-language') acceptLanguage: LanguageCode,
    @Query() query: GetProductFilterRequest,
  ): Promise<ResponseListDto<GetProductFilterResponse>> {
    const result = await this.productService.getProductFilter(
      query,
      acceptLanguage,
    );
    return new ResponseListDto(result);
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

  @Post('category')
  @ApiOperation({
    summary: 'Product category register',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async postProductCategory(@Body() body: PostProductCategoryRequest) {
    await this.productService.postProductCategory(body);
  }

  @Post('option')
  @ApiOperation({
    summary: 'Option register',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async postOption(@Body() body: PostOptionRequest) {
    await this.productService.postOption(body);
  }

  @Post('option/value')
  @ApiOperation({
    summary: 'Option value register',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async postOptionValue(@Body() body: PostOptionValueRequest) {
    await this.productService.postOptionValue(body);
  }

  @Post('item')
  @ApiOperation({
    summary: '색상별 상품 등록',
    description: `
      상품 리스트에 표시되는 상품을 등록하는 곳
      색깔별로 상품을 등록하지만 색상을 등록하기전에 상품 중 주제를 등록해야 합니다.
      색상은 /product/variant 에서 등록합니다.
    `,
  })
  @ResponseException(HttpStatus.NOT_FOUND, '상품이 존재하지 않습니다.')
  @HttpCode(HttpStatus.NO_CONTENT)
  async postProductItem(@Body() body: PostProductItemRequest) {
    await this.productService.postProductItem(body);
  }

  @Post('variant')
  @ApiOperation({
    summary: '실제 상품 등록',
    description: `
      실제 상품을 등록하는 곳입니다.
      만약 /product/item 에서 상품을 등록후 이 api 에서 sku, 재고 등을 등록합니다.
      색상은 /option/value 에서 값을 가져와 한번에 등록합니다 예를들여
      /product/item 에서 상품을 등록후 나온 id 값을 1 번이라고 했을때 이것을 빨강색 아디다스 저지이고 총 사이즈는 S, M, L 이라고 했을때
      request body 는 다음과 같습니다.
      {
        "productItemId": 1,
        "sku": "1234567890",
        "stock": 10,
        "optionValueIdList": [1, 2, 3, 4]
      }
      
      option value 1 = 빨강, 2 = S , 3 = M , 4 = L 이라고 가정한다면 다음과 같은 request body 가 됩니다.
    `,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async postProductVariant(@Body() body: PostProductVariantRequest) {
    await this.productService.postProductVariant(body);
  }
}

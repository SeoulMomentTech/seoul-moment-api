/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-lines-per-function */
import { PagingDto } from '@app/common/dto/global.dto';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { ProductSortDto } from '@app/repository/dto/product.dto';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { OptionRepositoryService } from '@app/repository/service/option.repository.service';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { Injectable } from '@nestjs/common';

import {
  GetProductBannerResponse,
  GetProductCategoryResponse,
  GetProductDetailResponse,
  GetProductDetailOption,
  GetProductRequest,
  GetProductResponse,
} from './product.dto';
import {
  GetOptionResponse,
  GetOptionValueResponse,
} from '../option/option.dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly productRepositoryService: ProductRepositoryService,
    private readonly optionRepositoryService: OptionRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  async getProductBanner(): Promise<GetProductBannerResponse[]> {
    const bannerList = await this.productRepositoryService.findBanner();

    return bannerList.map((v) => GetProductBannerResponse.from(v));
  }

  async getProductCategory(
    categoryId: number,
    language: LanguageCode,
  ): Promise<GetProductCategoryResponse[]> {
    const categoryList =
      await this.productRepositoryService.findCategoryByCategoryId(categoryId);

    const categoryText =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.PRODUCT_CATEGORY,
        categoryList.map((v) => v.id),
        language,
      );

    return categoryList.map((v) =>
      GetProductCategoryResponse.from(v, categoryText),
    );
  }

  async getProduct(
    dto: GetProductRequest,
    language: LanguageCode,
    withoutId?: number,
  ): Promise<[GetProductResponse[], number]> {
    const [productColorList, count] =
      await this.productRepositoryService.findProductColor(
        PagingDto.from(dto.page, dto.count),
        dto.isNotExistSort()
          ? undefined
          : ProductSortDto.from(dto.sortColum, dto.sort),
        dto.brandId,
        dto.categoryId,
        dto.productCategoryId,
        dto.search,
        withoutId,
      );

    const [brandText, productText] = await Promise.all([
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND,
        productColorList.map((v) => v.product.brand.id),
        language,
      ),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.PRODUCT,
        productColorList.map((v) => v.product.id),
        language,
      ),
    ]);

    return [
      productColorList.map((v) =>
        GetProductResponse.from(v, {
          brand: brandText,
          product: productText,
        }),
      ),
      count,
    ];
  }

  async getProductDetail(
    productColorId: number,
    language: LanguageCode,
  ): Promise<GetProductDetailResponse> {
    const languageEntity =
      await this.languageRepositoryService.findLanguageByCode(language);

    const productDetail =
      await this.productRepositoryService.getProductColorDetail(productColorId);

    // 필수 관계 데이터 검증
    if (!productDetail.product) {
      throw new ServiceError(
        'Product information not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    if (!productDetail.product.brand) {
      throw new ServiceError(
        'Brand information not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    const optionType =
      await this.productRepositoryService.getProductOptionTypes(
        productDetail.product.id,
      );

    const optionValueList = await Promise.all(
      optionType.map(async (v) =>
        GetProductDetailOption.from(
          v,
          await this.productRepositoryService.getProductOption(
            v,
            productDetail.product.id,
            languageEntity.id,
          ),
        ),
      ),
    );

    const [brandtext, productText] = await Promise.all([
      this.languageRepositoryService.findMultilingualTexts(
        EntityType.BRAND,
        productDetail.product.brand.id,
        language,
      ),
      this.languageRepositoryService.findMultilingualTexts(
        EntityType.PRODUCT,
        productDetail.product.id,
        language,
      ),
    ]);

    const [relate, count] = await this.getProduct(
      GetProductRequest.from(1, 5),
      language,
      productDetail.product.id,
    );

    return GetProductDetailResponse.from(
      productDetail,
      {
        brand: brandtext,
        product: productText,
      },
      optionValueList,
      relate,
    );
  }

  async getOption(): Promise<GetOptionResponse[]> {
    const optionEntites = await this.optionRepositoryService.getOption();

    return optionEntites.map((v) => GetOptionResponse.from(v));
  }

  async getOptionValue(
    optionId: number,
    language: LanguageCode,
  ): Promise<GetOptionValueResponse[]> {
    const optionValueEntites =
      await this.optionRepositoryService.getOptionValueByOptionId(optionId);

    const optionValueText =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.OPTION_VALUE,
        optionValueEntites.map((v) => v.id),
        language,
      );

    return optionValueEntites.map((v) =>
      GetOptionValueResponse.from(v, optionValueText),
    );
  }
}

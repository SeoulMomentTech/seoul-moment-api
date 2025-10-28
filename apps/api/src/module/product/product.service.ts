/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-lines-per-function */
import { PagingDto } from '@app/common/dto/global.dto';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { ProductSortDto } from '@app/repository/dto/product.dto';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { ProductCategoryEntity } from '@app/repository/entity/product-category.entity';
import { ProductEntity } from '@app/repository/entity/product.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { BrandRepositoryService } from '@app/repository/service/brand.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { OptionRepositoryService } from '@app/repository/service/option.repository.service';
import { ProductFilterRepositoryService } from '@app/repository/service/product-filter.repository.service';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  GetProductBannerResponse,
  GetProductCategoryResponse,
  GetProductDetailResponse,
  GetProductDetailOption,
  GetProductRequest,
  GetProductResponse,
  PostProductRequest,
  GetProductBannerByBrandResponse,
  GetProductSortFilterResponse,
  GetProductFilterResponse,
  ProductFilterDto,
  GetProductFilterRequest,
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
    private readonly brandRepositoryService: BrandRepositoryService,
    private readonly productFilterRepositoryService: ProductFilterRepositoryService,
  ) {}

  async getProductBanner(): Promise<GetProductBannerResponse[]> {
    const bannerList = await this.productRepositoryService.findBanner();

    return bannerList.map((v) => GetProductBannerResponse.from(v));
  }

  async getProductBannerByBrand(
    brandId: number,
    language: LanguageCode,
  ): Promise<GetProductBannerByBrandResponse> {
    const brandEntity =
      await this.brandRepositoryService.findBrandById(brandId);

    if (!brandEntity) {
      throw new ServiceError(
        'Brand not found',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    const multilingualText =
      await this.languageRepositoryService.findMultilingualTexts(
        EntityType.BRAND,
        brandEntity.id,
        language,
      );

    return GetProductBannerByBrandResponse.from(brandEntity, multilingualText);
  }

  async getProductCategory(
    categoryId: number,
    language: LanguageCode,
  ): Promise<GetProductCategoryResponse[]> {
    let categoryList: ProductCategoryEntity[] = [];
    let categoryText: MultilingualTextEntity[] = [];

    if (!categoryId) {
      categoryList = await this.productRepositoryService.findCategory();
      categoryText =
        await this.languageRepositoryService.findMultilingualTextsByEntities(
          EntityType.PRODUCT_CATEGORY,
          categoryList.map((v) => v.id),
          language,
        );
    } else {
      categoryList =
        await this.productRepositoryService.findCategoryByCategoryId(
          categoryId,
        );
      categoryText =
        await this.languageRepositoryService.findMultilingualTextsByEntities(
          EntityType.PRODUCT_CATEGORY,
          categoryList.map((v) => v.id),
          language,
        );
    }

    return categoryList.map((v) =>
      GetProductCategoryResponse.from(v, categoryText),
    );
  }

  async getProduct(
    dto: GetProductRequest,
    language: LanguageCode,
    withoutId?: number,
  ): Promise<[GetProductResponse[], number]> {
    const [productItemList, count] =
      await this.productRepositoryService.findProductItem(
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
        productItemList.map((v) => v.product.brand.id),
        language,
      ),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.PRODUCT,
        productItemList.map((v) => v.product.id),
        language,
      ),
    ]);

    return [
      productItemList.map((v) =>
        GetProductResponse.from(v, {
          brand: brandText,
          product: productText,
        }),
      ),
      count,
    ];
  }

  async getProductDetail(
    productItemId: number,
    language: LanguageCode,
  ): Promise<GetProductDetailResponse> {
    const languageEntity =
      await this.languageRepositoryService.findLanguageByCode(language);

    const productDetail =
      await this.productRepositoryService.getProductItemDetail(productItemId);

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

  @Transactional()
  async postProduct(dto: PostProductRequest) {
    const productEntity = await this.productRepositoryService.insert(
      plainToInstance(ProductEntity, {
        brandId: dto.brandId,
        categoryId: dto.categoryId,
        productCategoryId: dto.productCategoryId,
        detailInfoImageUrl: dto.detailInfoImageUrl,
      }),
    );

    for (const text of dto.text) {
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.PRODUCT,
        productEntity.id,
        'name',
        text.lenguageId,
        text.name,
      );
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.PRODUCT,
        productEntity.id,
        'origin',
        text.lenguageId,
        text.origin,
      );
    }
  }

  async getProductSortFilter(
    language: LanguageCode,
  ): Promise<GetProductSortFilterResponse[]> {
    const productFilterEntities =
      await this.productFilterRepositoryService.findAllProductFilters();
    const multilingualTexts =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.PRODUCT_FILTER,
        productFilterEntities.map((v) => v.id),
        language,
      );
    return productFilterEntities.map((v) =>
      GetProductSortFilterResponse.from(v, multilingualTexts),
    );
  }

  async getProductFilter(
    dto: GetProductFilterRequest,
    language: LanguageCode,
  ): Promise<GetProductFilterResponse> {
    const variantOptionEntities =
      await this.productRepositoryService.findVariantOptionsByProduct(
        dto.categoryId,
        dto.brandId,
        dto.productCategoryId,
      );

    const multilingualTexts =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.OPTION_VALUE,
        variantOptionEntities.map((v) => v.optionValue.id),
        language,
      );

    return GetProductFilterResponse.from(
      variantOptionEntities,
      multilingualTexts,
    );
  }
}

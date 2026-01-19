/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-lines-per-function */
import { PagingDto } from '@app/common/dto/global.dto';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { ProductSortDto } from '@app/repository/dto/product.dto';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { OptionValueEntity } from '@app/repository/entity/option-value.entity';
import { OptionEntity } from '@app/repository/entity/option.entity';
import { ProductCategoryEntity } from '@app/repository/entity/product-category.entity';
import { ProductItemImageEntity } from '@app/repository/entity/product-item-image.entity';
import { ProductItemEntity } from '@app/repository/entity/product-item.entity';
import { ProductVariantEntity } from '@app/repository/entity/product-variant.entity';
import { ProductEntity } from '@app/repository/entity/product.entity';
import { VariantOptionEntity } from '@app/repository/entity/variant-option.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { BrandRepositoryService } from '@app/repository/service/brand.repository.service';
import { CategoryRepositoryService } from '@app/repository/service/category.repository.service';
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
  GetProductRequest,
  GetProductResponse,
  PostProductRequest,
  GetProductBannerByBrandResponse,
  GetProductSortFilterResponse,
  GetProductFilterResponse,
  GetProductFilterRequest,
  ProductFilterOptionValue,
  PostProductCategoryRequest,
  PostOptionRequest,
  PostOptionValueRequest,
  PostProductItemRequest,
  PostProductVariantRequest,
  GetProductDetailOptionValue,
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
    private readonly categoryRepositoryService: CategoryRepositoryService,
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
          : ProductSortDto.from(dto.sortColumn, dto.sort),
        dto.brandId,
        dto.categoryId,
        dto.productCategoryId,
        dto.search,
        withoutId,
        dto.optionIdList,
      );

    const [brandText, productText, optionValueText] = await Promise.all([
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
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.OPTION_VALUE,
        productItemList.flatMap((v) =>
          v.variants.flatMap((v) =>
            v.variantOptions
              .filter((vo) => vo.optionValue?.option?.type === 'COLOR')
              .map((vo) => vo.optionValueId),
          ),
        ),
        language,
      ),
    ]);

    return [
      productItemList.map((v) =>
        GetProductResponse.from(v, {
          brand: brandText,
          product: productText,
          optionValue: optionValueText,
        }),
      ),
      count,
    ];
  }

  async getProductDetail(
    productItemId: number,
    language: LanguageCode,
  ): Promise<GetProductDetailResponse> {
    const [languageEntity, productDetail] = await Promise.all([
      this.languageRepositoryService.findLanguageByCode(language),
      this.productRepositoryService.getProductItemDetail(productItemId),
    ]);

    const productExternal =
      await this.productRepositoryService.getProductExternalByProductItemId(
        productDetail.id,
      );

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
        productDetail.id,
      );

    const optionValueMap: Record<string, any> = {};
    for (const v of optionType) {
      optionValueMap[v] = await this.productRepositoryService.getProductOption(
        v,
        productDetail.id,
        languageEntity.id,
      );
    }

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
      productExternal,
      {
        brand: brandtext,
        product: productText,
      },
      optionValueMap,
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
      await this.optionRepositoryService.findOptionValueByOptionId(optionId);

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
    await Promise.all([
      this.brandRepositoryService.getBrandById(dto.brandId),
      this.categoryRepositoryService.getCategoryById(dto.categoryId),
      this.categoryRepositoryService.getProductCategoryById(
        dto.productCategoryId,
      ),
    ]);

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
        text.languageId,
        text.name,
      );
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.PRODUCT,
        productEntity.id,
        'origin',
        text.languageId,
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
  ): Promise<GetProductFilterResponse[]> {
    const productFilterDtos =
      await this.productRepositoryService.findDistinctFilterOptionsByProduct(
        dto.categoryId,
        language,
        dto.brandId,
        dto.productCategoryId,
      );

    // Group by optionType and aggregate option values
    const grouped = new Map<string, ProductFilterOptionValue[]>();
    const optionUiType = new Map<string, string>();
    const seenByType = new Map<string, Set<number>>();

    for (const v of productFilterDtos) {
      const key = String(v.optionType);
      optionUiType.set(key, v.optionUiType);
      let list = grouped.get(key);
      let seenSet = seenByType.get(key);

      if (!list) {
        list = [];
        grouped.set(key, list);
      }
      if (!seenSet) {
        seenSet = new Set<number>();
        seenByType.set(key, seenSet);
      }

      if (!seenSet.has(v.optionValueId)) {
        list.push(
          ProductFilterOptionValue.from(v.optionValueId, v.name, v.code),
        );
        seenSet.add(v.optionValueId);
      }
    }

    return Array.from(grouped.entries()).map(([optionType, optionValueList]) =>
      GetProductFilterResponse.from(
        optionType,
        optionUiType.get(optionType),
        optionValueList,
      ),
    );
  }

  @Transactional()
  async postProductCategory(dto: PostProductCategoryRequest) {
    const productCategoryEntity =
      await this.categoryRepositoryService.insertProductCategory(
        plainToInstance(ProductCategoryEntity, {
          categoryId: dto.categoryId,
          imageUrl: dto.imageUrl,
        }),
      );

    for (const text of dto.list) {
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.PRODUCT_CATEGORY,
        productCategoryEntity.id,
        'name',
        text.languageId,
        text.name,
      );
    }
  }

  @Transactional()
  async postOption(dto: PostOptionRequest) {
    const optionEntity = await this.optionRepositoryService.insertOption(
      plainToInstance(OptionEntity, {
        type: dto.type,
        uiType: dto.uiType,
      }),
    );

    for (const text of dto.text) {
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.OPTION,
        optionEntity.id,
        'name',
        text.languageId,
        text.name,
      );
    }
  }

  @Transactional()
  async postOptionValue(dto: PostOptionValueRequest) {
    const optionValueEntity =
      await this.optionRepositoryService.insertOptionValue(
        plainToInstance(OptionValueEntity, {
          optionId: dto.optionId,
          colorCode: dto.colorCode,
        }),
      );

    for (const text of dto.text) {
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.OPTION_VALUE,
        optionValueEntity.id,
        'value',
        text.languageId,
        text.value,
      );
    }
  }

  @Transactional()
  async postProductItem(dto: PostProductItemRequest) {
    await this.productRepositoryService.getProductByProductId(dto.productId);

    const productItemEntity =
      await this.productRepositoryService.insertProductItem(
        plainToInstance(ProductItemEntity, {
          productId: dto.productId,
          mainImageUrl: dto.mainImageUrl,
          price: dto.price,
          discountPrice: dto.discountPrice,
          shippingCost: dto.shippingCost,
          shippingInfo: dto.shippingInfo,
        }),
      );

    if (dto.imageUrlList.length > 0) {
      for (const imageUrl of dto.imageUrlList) {
        await this.productRepositoryService.insertProductItemImage(
          plainToInstance(ProductItemImageEntity, {
            productItemId: productItemEntity.id,
            imageUrl,
          }),
        );
      }
    }
  }

  @Transactional()
  async postProductVariant(dto: PostProductVariantRequest) {
    await this.productRepositoryService.getProductItemById(
      dto.productItemId,
    );

    const skuExists =
      await this.productRepositoryService.existProductVariantBySku(dto.sku);
    if (skuExists) {
      throw new ServiceError(
        `SKU가 이미 존재합니다.: ${dto.sku}`,
        ServiceErrorCode.CONFLICT,
      );
    }

    const productVariantEntity =
      await this.productRepositoryService.insertProductVariant(
        plainToInstance(ProductVariantEntity, {
          productItemId: dto.productItemId,
          sku: dto.sku,
          stockQuantity: dto.stockQuantity,
        }),
      );

    await Promise.all(
      dto.optionValueIdList.map(async (v) =>
        this.optionRepositoryService.getOptionValueByOptionValueId(v),
      ),
    );

    await this.optionRepositoryService.bulkInsertVariantOption(
      dto.optionValueIdList.map((v) =>
        plainToInstance(VariantOptionEntity, {
          variantId: productVariantEntity.id,
          optionValueId: v,
        }),
      ),
    );
  }
}

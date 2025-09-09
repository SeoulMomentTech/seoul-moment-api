import { PagingDto } from '@app/common/dto/global.dto';
import { ProductSortDto } from '@app/repository/dto/product.dto';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { Injectable } from '@nestjs/common';

import {
  GetProductBannerResponse,
  GetProductCategoryResponse,
  GetProductRequest,
  GetProductResponse,
} from './product.dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly productRepositoryService: ProductRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  async getProductBanner(): Promise<GetProductBannerResponse[]> {
    const bannerList = await this.productRepositoryService.findBanner();

    return bannerList.map((v) => GetProductBannerResponse.from(v));
  }

  async getProductCategory(
    language: LanguageCode,
  ): Promise<GetProductCategoryResponse[]> {
    const categoryList = await this.productRepositoryService.findCategory();

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
}

import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { Injectable } from '@nestjs/common';

import {
  GetProductBannerResponse,
  GetProductCategoryResponse,
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

  // TODO Response 만들어야 함
  async getProduct(): Promise<void> {}
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ArticleSectionImageEntity } from './entity/article-section-image.entity';
import { ArticleSectionEntity } from './entity/article-section.entity';
import { ArticleEntity } from './entity/article.entity';
import { BrandBannerImageEntity } from './entity/brand-banner-image.entity';
import { BrandSectionImageEntity } from './entity/brand-section-image.entity';
import { BrandSectionEntity } from './entity/brand-section.entity';
import { BrandEntity } from './entity/brand.entity';
import { CategoryEntity } from './entity/category.entity';
import { HomeBannerImageEntity } from './entity/home-banner-image.entity';
import { HomeSectionImageEntity } from './entity/home-section-image.entity';
import { HomeSectionEntity } from './entity/home-section.entity';
import { LanguageEntity } from './entity/language.entity';
import { MultilingualTextEntity } from './entity/multilingual-text.entity';
import { NewsSectionImageEntity } from './entity/news-section-image.entity';
import { NewsSectionEntity } from './entity/news-section.entity';
import { NewsEntity } from './entity/news.entity';
import { OptionValueEntity } from './entity/option-value.entity';
import { OptionEntity } from './entity/option.entity';
import { PartnerCategoryEntity } from './entity/partner-category.entity';
import { PartnerEntity } from './entity/partner.entity';
import { ProductCategoryEntity } from './entity/product-category.entity';
import { ProductColorImageEntity } from './entity/product-color-image.entity';
import { ProductColorEntity } from './entity/product-color.entity';
import { ProductImageEntity } from './entity/product-image.entity';
import { ProductVariantEntity } from './entity/product-variant.entity';
import { ProductEntity } from './entity/product.entity';
import { ProductBannerEntity } from './entity/product_banner.entity';
import { VariantOptionEntity } from './entity/variant-option.entity';
import { SortOrderHelper } from './helper/sort-order.helper';
import { ArticleRepositoryService } from './service/article.repository.service';
import { BrandRepositoryService } from './service/brand.repository.service';
import { CategoryRepositoryService } from './service/category.repository.service';
import { HomeRepositoryService } from './service/home.repository.service';
import { LanguageRepositoryService } from './service/language.repository.service';
import { NewsRepositoryService } from './service/news.repository.service';
import { PartnerRepositoryService } from './service/partner.repository.service';
import { ProductRepositoryService } from './service/product.repository.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BrandEntity,
      BrandBannerImageEntity,
      BrandSectionEntity,
      BrandSectionImageEntity,
      LanguageEntity,
      MultilingualTextEntity,
      CategoryEntity,
      NewsEntity,
      NewsSectionEntity,
      NewsSectionImageEntity,
      ArticleEntity,
      ArticleSectionEntity,
      ArticleSectionImageEntity,
      HomeSectionEntity,
      HomeSectionImageEntity,
      HomeBannerImageEntity,
      ProductEntity,
      ProductBannerEntity,
      ProductCategoryEntity,
      ProductColorEntity,
      ProductColorImageEntity,
      ProductImageEntity,
      ProductVariantEntity,
      OptionEntity,
      OptionValueEntity,
      VariantOptionEntity,
      PartnerEntity,
      PartnerCategoryEntity,
    ]),
  ],
  providers: [
    SortOrderHelper,
    BrandRepositoryService,
    LanguageRepositoryService,
    NewsRepositoryService,
    ArticleRepositoryService,
    HomeRepositoryService,
    ProductRepositoryService,
    CategoryRepositoryService,
    PartnerRepositoryService,
  ],
  exports: [
    SortOrderHelper,
    BrandRepositoryService,
    LanguageRepositoryService,
    NewsRepositoryService,
    ArticleRepositoryService,
    HomeRepositoryService,
    ProductRepositoryService,
    CategoryRepositoryService,
    PartnerRepositoryService,
  ],
})
export class RepositoryModule {}

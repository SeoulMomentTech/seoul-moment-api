import { ArticleSectionImageEntity } from '@app/repository/entity/article-section-image.entity';
import { ArticleSectionEntity } from '@app/repository/entity/article-section.entity';
import { ArticleEntity } from '@app/repository/entity/article.entity';
import { BrandBannerImageEntity } from '@app/repository/entity/brand-banner-image.entity';
import { BrandSectionImageEntity } from '@app/repository/entity/brand-section-image.entity';
import { BrandSectionEntity } from '@app/repository/entity/brand-section.entity';
import { BrandEntity } from '@app/repository/entity/brand.entity';
import { CategoryEntity } from '@app/repository/entity/category.entity';
import { HomeBannerImageEntity } from '@app/repository/entity/home-banner-image.entity';
import { HomeSectionImageEntity } from '@app/repository/entity/home-section-image.entity';
import { HomeSectionEntity } from '@app/repository/entity/home-section.entity';
import { LanguageEntity } from '@app/repository/entity/language.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { NewsSectionImageEntity } from '@app/repository/entity/news-section-image.entity';
import { NewsSectionEntity } from '@app/repository/entity/news-section.entity';
import { NewsEntity } from '@app/repository/entity/news.entity';
import { OptionValueEntity } from '@app/repository/entity/option-value.entity';
import { OptionEntity } from '@app/repository/entity/option.entity';
import { PartnerCategoryEntity } from '@app/repository/entity/partner-category.entity';
import { PartnerEntity } from '@app/repository/entity/partner.entity';
import { ProductCategoryEntity } from '@app/repository/entity/product-category.entity';
import { ProductColorImageEntity } from '@app/repository/entity/product-color-image.entity';
import { ProductColorEntity } from '@app/repository/entity/product-color.entity';
import { ProductImageEntity } from '@app/repository/entity/product-image.entity';
import { ProductVariantEntity } from '@app/repository/entity/product-variant.entity';
import { ProductEntity } from '@app/repository/entity/product.entity';
import { ProductBannerEntity } from '@app/repository/entity/product_banner.entity';
import { VariantOptionEntity } from '@app/repository/entity/variant-option.entity';
import { SortOrderHelper } from '@app/repository/helper/sort-order.helper';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TestCacheModule } from './test-cache.module';

@Module({
  imports: [
    TestCacheModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT || '5433'),
      username: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      entities: [
        ArticleEntity,
        ArticleSectionEntity,
        ArticleSectionImageEntity,
        BrandEntity,
        BrandBannerImageEntity,
        BrandSectionEntity,
        BrandSectionImageEntity,
        CategoryEntity,
        HomeBannerImageEntity,
        HomeSectionEntity,
        HomeSectionImageEntity,
        LanguageEntity,
        MultilingualTextEntity,
        NewsEntity,
        NewsSectionEntity,
        NewsSectionImageEntity,
        OptionEntity,
        OptionValueEntity,
        ProductColorEntity,
        ProductColorImageEntity,
        ProductCategoryEntity,
        ProductEntity,
        ProductImageEntity,
        ProductVariantEntity,
        VariantOptionEntity,
        ProductBannerEntity,
        PartnerEntity,
        PartnerCategoryEntity,
      ],
      synchronize: true, // 테스트용으로만 true 사용
      dropSchema: false, // 스키마를 유지하고 데이터만 정리
      logging: false, // 테스트 시 로깅 비활성화
    }),
    TypeOrmModule.forFeature([
      ArticleEntity,
      ArticleSectionEntity,
      ArticleSectionImageEntity,
      BrandEntity,
      BrandBannerImageEntity,
      BrandSectionEntity,
      BrandSectionImageEntity,
      CategoryEntity,
      HomeBannerImageEntity,
      HomeSectionEntity,
      HomeSectionImageEntity,
      LanguageEntity,
      MultilingualTextEntity,
      NewsEntity,
      NewsSectionEntity,
      NewsSectionImageEntity,
      OptionEntity,
      OptionValueEntity,
      ProductColorEntity,
      ProductColorImageEntity,
      ProductCategoryEntity,
      ProductEntity,
      ProductImageEntity,
      ProductVariantEntity,
      VariantOptionEntity,
      ProductBannerEntity,
      PartnerEntity,
      PartnerCategoryEntity,
    ]),
  ],
  providers: [SortOrderHelper],
  exports: [TestCacheModule, TypeOrmModule, SortOrderHelper],
})
export class TestDatabaseModule {}

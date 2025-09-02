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
import { ArticleRepositoryService } from './service/article.repository.service';
import { BrandRepositoryService } from './service/brand.repository.service';
import { LanguageRepositoryService } from './service/language.repository.service';
import { NewsRepositoryService } from './service/news.repository.service';

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
    ]),
  ],
  providers: [
    BrandRepositoryService,
    LanguageRepositoryService,
    NewsRepositoryService,
    ArticleRepositoryService,
  ],
  exports: [
    BrandRepositoryService,
    LanguageRepositoryService,
    NewsRepositoryService,
    ArticleRepositoryService,
  ],
})
export class RepositoryModule {}

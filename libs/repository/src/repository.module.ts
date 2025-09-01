import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BrandBannerImageEntity } from './entity/brand-banner-image.entity';
import { BrandSectionImageEntity } from './entity/brand-section-image.entity';
import { BrandSectionEntity } from './entity/brand-section.entity';
import { BrandEntity } from './entity/brand.entity';
import { LanguageEntity } from './entity/language.entity';
import { MultilingualTextEntity } from './entity/multilingual-text.entity';
import { BrandRepositoryService } from './service/brand.repository.service';
import { LanguageRepositoryService } from './service/language.repository.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BrandEntity,
      BrandBannerImageEntity,
      BrandSectionEntity,
      BrandSectionImageEntity,
      LanguageEntity,
      MultilingualTextEntity,
    ]),
  ],
  providers: [BrandRepositoryService, LanguageRepositoryService],
  exports: [BrandRepositoryService, LanguageRepositoryService],
})
export class RepositoryModule {}

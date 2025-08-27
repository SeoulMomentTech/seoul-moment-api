import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BrandBannerImageEntity } from './entity/brand-banner-image.entity';
import { BrandSectionEntity } from './entity/brand-info-section.entity';
import { BrandSectionImageEntity } from './entity/brand-section-image.entity';
import { BrandEntity } from './entity/brand.entity';
import { BrandRepositoryService } from './service/brand.repository.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BrandEntity,
      BrandBannerImageEntity,
      BrandSectionEntity,
      BrandSectionImageEntity,
    ]),
  ],
  providers: [BrandRepositoryService],
  exports: [BrandRepositoryService],
})
export class RepositoryModule {}

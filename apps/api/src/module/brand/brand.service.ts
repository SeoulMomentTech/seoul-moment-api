/* eslint-disable max-lines-per-function */
import { BrandBannerImageEntity } from '@app/repository/entity/brand-banner-image.entity';
import { BrandSectionImageEntity } from '@app/repository/entity/brand-section-image.entity';
import { BrandSectionEntity } from '@app/repository/entity/brand-section.entity';
import { BrandEntity } from '@app/repository/entity/brand.entity';
import { BrandNameFilter } from '@app/repository/enum/brand.enum';
import { EntityType } from '@app/repository/enum/entity.enum';
import {
  LanguageCode,
  DEFAULT_LANGUAGE,
} from '@app/repository/enum/language.enum';
import { BrandRepositoryService } from '@app/repository/service/brand.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  GetBrandIntroduceResponse,
  GetBrandListByName,
  GetBrandListByNameResponse,
  PostBrandRequest,
} from './brand.dto';

@Injectable()
export class BrandService {
  constructor(
    private readonly brandRepositoryService: BrandRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  async getBrandIntroduce(
    id: number,
    languageCode: LanguageCode = DEFAULT_LANGUAGE,
  ): Promise<GetBrandIntroduceResponse> {
    const brandEntity = await this.brandRepositoryService.getBrandById(id);

    // Fetch multilingual texts for brand and sections
    const [brandTexts, sectionTexts] = await Promise.all([
      this.languageRepositoryService.findMultilingualTexts(
        EntityType.BRAND,
        brandEntity.id,
        languageCode,
      ),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND_SECTION,
        brandEntity.section.map((section) => section.id),
        languageCode,
      ),
    ]);

    const brandMultilingual = {
      brandText: brandTexts,
      sectionText: sectionTexts,
    };

    return GetBrandIntroduceResponse.from(
      brandEntity,
      brandMultilingual,
      languageCode,
    );
  }

  async getBrandListByNameFilterType(
    filter: BrandNameFilter,
    categoryId?: number,
  ): Promise<GetBrandListByName[]> {
    const brandEntityList =
      await this.brandRepositoryService.findAllNormalBrandListByFilter(
        filter,
        categoryId,
      );

    const brandText =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND,
        brandEntityList.map((v) => v.id),
        LanguageCode.ENGLISH, // 영어 고정
      );

    return brandEntityList
      .map((v) => GetBrandListByName.from(v, brandText))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getBrandListByName(
    categoryId?: number,
  ): Promise<GetBrandListByNameResponse[]> {
    const result: GetBrandListByNameResponse[] = [];

    for (const value of Object.values(BrandNameFilter)) {
      const brandListByNameFilterType = await this.getBrandListByNameFilterType(
        value,
        categoryId,
      );

      result.push(
        GetBrandListByNameResponse.from(value, brandListByNameFilterType),
      );
    }

    return result;
  }

  @Transactional()
  async postBrand(dto: PostBrandRequest) {
    const brandEntity = await this.brandRepositoryService.insert(
      plainToInstance(BrandEntity, {
        categoryId: dto.categoryId,
        profileImage: dto.profileImageUrl ?? undefined,
      }),
    );

    const bannerEntities = dto.bannerImageUrlList.map((bannerUrl, index) =>
      plainToInstance(BrandBannerImageEntity, {
        brandId: brandEntity.id,
        imageUrl: bannerUrl,
        sortOrder: index + 1,
      }),
    );

    await this.brandRepositoryService.bulkInsertInitBannerImage(bannerEntities);

    await Promise.all(
      dto.textList.flatMap((v) => [
        this.languageRepositoryService.saveMultilingualText(
          EntityType.BRAND,
          brandEntity.id,
          'name',
          v.languageId,
          v.name,
        ),
        this.languageRepositoryService.saveMultilingualText(
          EntityType.BRAND,
          brandEntity.id,
          'description',
          v.languageId,
          v.description,
        ),
      ]),
    );

    for (const v of dto.sectionList) {
      const brandSectionEntity =
        await this.brandRepositoryService.insertSection(
          plainToInstance(BrandSectionEntity, {
            brandId: brandEntity.id,
          }),
        );

      await Promise.all(
        v.textList.flatMap((text) => [
          this.languageRepositoryService.saveMultilingualText(
            EntityType.BRAND_SECTION,
            brandSectionEntity.id,
            'title',
            text.languageId,
            text.title,
          ),
          this.languageRepositoryService.saveMultilingualText(
            EntityType.BRAND_SECTION,
            brandSectionEntity.id,
            'content',
            text.languageId,
            text.content,
          ),
        ]),
      );

      const brandSectionImages = v.imageUrlList.map((image, index) =>
        plainToInstance(BrandSectionImageEntity, {
          sectionId: brandSectionEntity.id,
          imageUrl: image,
          sortOrder: index + 1,
        }),
      );

      await this.brandRepositoryService.bulkInsertInitSectionImage(
        brandSectionImages,
      );
    }
  }
}

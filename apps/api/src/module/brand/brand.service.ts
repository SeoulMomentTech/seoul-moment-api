import { BrandNameFilter } from '@app/repository/enum/brand.enum';
import { EntityType } from '@app/repository/enum/entity.enum';
import {
  LanguageCode,
  DEFAULT_LANGUAGE,
} from '@app/repository/enum/language.enum';
import { BrandRepositoryService } from '@app/repository/service/brand.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';

import {
  GetBrandIntroduceResponse,
  GetBrandListByNameFilterTypeResponse,
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
  ): Promise<GetBrandListByNameFilterTypeResponse[]> {
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
      .map((v) => GetBrandListByNameFilterTypeResponse.from(v, brandText))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

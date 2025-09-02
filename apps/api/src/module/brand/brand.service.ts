import {
  LanguageCode,
  DEFAULT_LANGUAGE,
} from '@app/repository/enum/language.enum';
import { BrandRepositoryService } from '@app/repository/service/brand.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';

import { GetBrandIntroduceResponse } from './brand.dto';

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
        'brand',
        brandEntity.id,
        languageCode,
      ),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        'brand_section',
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
}

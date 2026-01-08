import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { PartnerRepositoryService } from '@app/repository/service/partner.repository.service';
import { Injectable } from '@nestjs/common';

import { GetPartnerCategoryResponse, GetPartnerResponse } from './partner.dto';

@Injectable()
export class PartnerService {
  constructor(
    private readonly partnerRepositoryService: PartnerRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  async getPartner(
    partnerCategoryId: number,
    language: LanguageCode,
  ): Promise<GetPartnerResponse[]> {
    const partnerEntitis =
      await this.partnerRepositoryService.findByCategoryId(partnerCategoryId);

    const partnerText =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.PARTNER,
        partnerEntitis.map((v) => v.id),
        language,
      );

    return partnerEntitis.map((v) => GetPartnerResponse.from(v, partnerText));
  }

  async getPartnerCategory(
    language: LanguageCode,
  ): Promise<GetPartnerCategoryResponse[]> {
    const partnerCategoryEntites =
      await this.partnerRepositoryService.findCategoryAll();

    const partnerCategoryTexts =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.PARTNER_CATEGORY,
        partnerCategoryEntites.map((v) => v.id),
        language,
      );

    return partnerCategoryEntites.map((v) =>
      GetPartnerCategoryResponse.from(v, partnerCategoryTexts),
    );
  }
}

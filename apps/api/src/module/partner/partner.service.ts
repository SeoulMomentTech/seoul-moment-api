import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { PartnerRepositoryService } from '@app/repository/service/partner.repository.service';
import { Injectable } from '@nestjs/common';

import { GetPartnerResponse } from './partner.dto';

@Injectable()
export class PartnerService {
  constructor(
    private readonly partnerRepositoryService: PartnerRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  async getPartner(
    categoryId: number,
    language: LanguageCode,
  ): Promise<GetPartnerResponse[]> {
    const partnerEntitis =
      await this.partnerRepositoryService.findByCategoryId(categoryId);

    const partnerText =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.PARTNER,
        partnerEntitis.map((v) => v.id),
        language,
      );

    return partnerEntitis.map((v) => GetPartnerResponse.from(v, partnerText));
  }
}

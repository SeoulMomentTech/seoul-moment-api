import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { BrandPromotionRepositoryService } from '@app/repository/service/brand-promotion.repository.service';
import { HomeRepositoryService } from '@app/repository/service/home.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';

import { GetHomeResponse } from './home.dto';

@Injectable()
export class HomeService {
  constructor(
    private readonly homeRepositoryService: HomeRepositoryService,
    private readonly promotionRepositoryService: BrandPromotionRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  async getHome(language: LanguageCode): Promise<GetHomeResponse> {
    const homeEntity = await this.homeRepositoryService.findHome();

    const [promotionList] =
      await this.promotionRepositoryService.findPromotionListByPaging(1, 10);

    const promotionMultilingualTextEntity =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.PROMOTION,
        promotionList.map((promotion) => promotion.id),
        language,
      );

    return GetHomeResponse.from(
      homeEntity.banner,
      promotionList,
      promotionMultilingualTextEntity,
    );
  }
}

import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { BrandPromotionRepositoryService } from '@app/repository/service/brand-promotion.repository.service';
import { HomeRepositoryService } from '@app/repository/service/home.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';

import { GetHomeResponse } from './home.dto';
import { V1GetHomeResponse } from './v1/home.v1.dto';

@Injectable()
export class HomeService {
  constructor(
    private readonly homeRepositoryService: HomeRepositoryService,
    private readonly promotionRepositoryService: BrandPromotionRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  async getHome(language: LanguageCode): Promise<GetHomeResponse> {
    const homeBannerImageEntityList =
      await this.homeRepositoryService.findHome();

    const [promotionList] =
      await this.promotionRepositoryService.findPromotionListByPaging(1, 10);

    const promotionMultilingualTextEntity =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.PROMOTION,
        promotionList.map((promotion) => promotion.id),
        language,
      );

    return GetHomeResponse.from(
      homeBannerImageEntityList,
      promotionList,
      promotionMultilingualTextEntity,
    );
  }

  async v1GetHome(language: LanguageCode): Promise<V1GetHomeResponse> {
    const homeBannerImageEntityList =
      await this.homeRepositoryService.findHome();

    const [promotionList] =
      await this.promotionRepositoryService.findPromotionListByPaging(1, 10);

    const promotionMultilingualTextEntity =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.PROMOTION,
        promotionList.map((promotion) => promotion.id),
        language,
      );

    return V1GetHomeResponse.from(
      homeBannerImageEntityList,
      promotionList,
      promotionMultilingualTextEntity,
    );
  }
}

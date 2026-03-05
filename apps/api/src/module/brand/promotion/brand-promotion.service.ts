import { BrandPromotionRepositoryService } from '@app/repository/service/brand-promotion.repository.service';
import { Injectable } from '@nestjs/common';

import { GetBrandPromotionResponse } from './brand-promotion.dto';

@Injectable()
export class BrandPromotionService {
  constructor(
    private readonly brandPromotionRepositoryService: BrandPromotionRepositoryService,
  ) {}

  async getBrandPromotionList(): Promise<GetBrandPromotionResponse[]> {
    const brandPromotions =
      await this.brandPromotionRepositoryService.findBrandPromotionList();

    return brandPromotions.map((brandPromotion) =>
      GetBrandPromotionResponse.from(brandPromotion),
    );
  }
}

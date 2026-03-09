import { BrandPromotionEntity } from '@app/repository/entity/brand-promotion.entity';
import { BrandPromotionRepositoryService } from '@app/repository/service/brand-promotion.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import {
  GetAdminBrandPromotionDetailResponse,
  GetAdminBrandPromotionListRequest,
  GetAdminBrandPromotionResponse,
  PostAdminBrandPromotionRequest,
} from './admin.brand.promotion.dto';

@Injectable()
export class AdminBrandPromotionService {
  constructor(
    private readonly brandPromotionRepositoryService: BrandPromotionRepositoryService,
  ) {}

  async createBrandPromotion(request: PostAdminBrandPromotionRequest) {
    await this.brandPromotionRepositoryService.createBrandPromotion(
      plainToInstance(BrandPromotionEntity, {
        brandId: request.brandId,
        isActive: request.isActive,
      }),
    );
  }

  async getBrandPromotionList(
    request: GetAdminBrandPromotionListRequest,
  ): Promise<[GetAdminBrandPromotionResponse[], number]> {
    const [brandPromotions, total] =
      await this.brandPromotionRepositoryService.findBrandPromotionListByPaging(
        request.page,
        request.count,
        request.search,
      );

    return [
      brandPromotions.map((brandPromotion) =>
        GetAdminBrandPromotionResponse.from(brandPromotion),
      ),
      total,
    ];
  }

  async getBrandPromotionDetail(
    id: number,
  ): Promise<GetAdminBrandPromotionDetailResponse> {
    const brandPromotion =
      await this.brandPromotionRepositoryService.getBrandPromotionById(id);

    return GetAdminBrandPromotionDetailResponse.from(brandPromotion);
  }

  async deleteBrandPromotion(id: number) {
    await this.brandPromotionRepositoryService.deleteBrandPromotion(id);
  }
}

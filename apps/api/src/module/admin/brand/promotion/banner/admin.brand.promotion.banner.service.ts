import { DeviceType } from '@app/repository/dto/common.dto';
import { BrandPromotionBannerEntity } from '@app/repository/entity/brand-promotion-banner.entity';
import { BrandPromotionBannerImageEntity } from '@app/repository/entity/brand-promotion-banner.image.entity';
import { BrandPromotionRepositoryService } from '@app/repository/service/brand-promotion.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  GetAdminBrandPromotionBannerDetailResponse,
  GetAdminBrandPromotionBannerRequest,
  GetAdminBrandPromotionBannerResponse,
  PatchAdminBrandPromotionBannerRequest,
  PostAdminBrandPromotionBannerRequest,
} from './admin.brand.promotion.banner.dto';

@Injectable()
export class AdminBrandPromotionBannerService {
  constructor(
    private readonly brandPromotionRepositoryService: BrandPromotionRepositoryService,
  ) {}

  @Transactional()
  async createBrandPromotionBanner(
    request: PostAdminBrandPromotionBannerRequest,
  ) {
    const bannerEntity =
      await this.brandPromotionRepositoryService.createBrandPromotionBanner(
        plainToInstance(BrandPromotionBannerEntity, {
          brandPromotionId: request.brandPromotionId,
          linkUrl: request.linkUrl,
        }),
      );

    await this.createBrandPromotionBannerImage(
      bannerEntity.id,
      request.imagePath,
      request.mobileImagePath,
    );
  }

  async getBrandPromotionBannerList(
    request: GetAdminBrandPromotionBannerRequest,
  ): Promise<[GetAdminBrandPromotionBannerResponse[], number]> {
    const [brandPromotionBanners, total] =
      await this.brandPromotionRepositoryService.findBrandPromotionBannerListByPaging(
        request.page,
        request.count,
      );

    return [
      brandPromotionBanners.map((brandPromotionBanner) =>
        GetAdminBrandPromotionBannerResponse.from(brandPromotionBanner),
      ),
      total,
    ];
  }

  async getBrandPromotionBannerDetail(
    id: number,
  ): Promise<GetAdminBrandPromotionBannerDetailResponse> {
    const brandPromotionBanner =
      await this.brandPromotionRepositoryService.getBrandPromotionBannerById(
        id,
      );

    return GetAdminBrandPromotionBannerDetailResponse.from(
      brandPromotionBanner,
    );
  }

  @Transactional()
  async patchBrandPromotionBanner(
    id: number,
    request: PatchAdminBrandPromotionBannerRequest,
  ) {
    await this.brandPromotionRepositoryService.updateBrandPromotionBanner({
      id,
      brandPromotionId: request.brandPromotionId,
      linkUrl: request.linkUrl,
    });

    await this.brandPromotionRepositoryService.deleteBrandPromotionBannerImageByBrandPromotionBannerId(
      id,
    );

    await this.createBrandPromotionBannerImage(
      id,
      request.getImagePath(),
      request.getMobileImagePath(),
    );
  }

  async deleteBrandPromotionBanner(id: number) {
    await this.brandPromotionRepositoryService.deleteBrandPromotionBanner(id);
  }

  private async createBrandPromotionBannerImage(
    brandPromotionBannerId: number,
    imagePath: string,
    mobileImagePath: string,
  ) {
    await this.brandPromotionRepositoryService.createBrandPromotionBannerImage(
      plainToInstance(BrandPromotionBannerImageEntity, {
        brandPromotionBannerId,
        imagePath,
        deviceType: DeviceType.DESKTOP,
      }),
    );

    await this.brandPromotionRepositoryService.createBrandPromotionBannerImage(
      plainToInstance(BrandPromotionBannerImageEntity, {
        brandPromotionBannerId,
        imagePath: mobileImagePath,
        deviceType: DeviceType.MOBILE,
      }),
    );
  }
}

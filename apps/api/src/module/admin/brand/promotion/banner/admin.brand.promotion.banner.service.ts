import { DeviceType } from '@app/repository/dto/common.dto';
import { BrandPromotionBannerEntity } from '@app/repository/entity/brand-promotion-banner.entity';
import { BrandPromotionBannerImageEntity } from '@app/repository/entity/brand-promotion-banner.image.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { BrandPromotionRepositoryService } from '@app/repository/service/brand-promotion.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';
import { MultilingualFieldDto } from 'apps/api/src/module/dto/multilingual.dto';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  AdminBrandPromotionBannerLanguageDto,
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
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  @Transactional()
  async createBrandPromotionBanner(
    request: PostAdminBrandPromotionBannerRequest,
  ) {
    await this.brandPromotionRepositoryService.getBrandPromotionById(
      request.brandPromotionId,
    );

    const bannerEntity =
      await this.brandPromotionRepositoryService.createBrandPromotionBanner(
        plainToInstance(BrandPromotionBannerEntity, {
          brandPromotionId: request.brandPromotionId,
          linkUrl: request.linkUrl,
        }),
      );

    await Promise.all(
      request.language.map(async (language) => {
        await this.languageRepositoryService.saveMultilingualText(
          EntityType.BRAND_PROMOTION_BANNER,
          bannerEntity.id,
          'title',
          language.languageId,
          language.title,
        );
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
        request.brandPromotionId,
      );

    if (brandPromotionBanners.length === 0) {
      return [[], total];
    }

    const [languages, multilingualTexts] = await Promise.all([
      this.languageRepositoryService.findAllActiveLanguages(),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND_PROMOTION_BANNER,
        brandPromotionBanners.map((b) => b.id),
      ),
    ]);

    const brandPromotionBannerList = brandPromotionBanners.map(
      (brandPromotionBanner) => {
        const titleTextsByEntityAndLanguage =
          MultilingualFieldDto.fromByEntityList(
            multilingualTexts.filter(
              (v) => v.entityId === brandPromotionBanner.id,
            ),
            'title',
          );

        const nameDto = languages.map((language) =>
          AdminBrandPromotionBannerLanguageDto.from(
            language.code,
            titleTextsByEntityAndLanguage.getContentByLanguage(language.code),
          ),
        );

        return GetAdminBrandPromotionBannerResponse.from(
          brandPromotionBanner,
          nameDto,
        );
      },
    );

    return [brandPromotionBannerList, total];
  }

  async getBrandPromotionBannerDetail(
    id: number,
  ): Promise<GetAdminBrandPromotionBannerDetailResponse> {
    const brandPromotionBanner =
      await this.brandPromotionRepositoryService.getBrandPromotionBannerById(
        id,
      );

    const [languages, multilingualTexts] = await Promise.all([
      this.languageRepositoryService.findAllActiveLanguages(),
      this.languageRepositoryService.findMultilingualTexts(
        EntityType.BRAND_PROMOTION_BANNER,
        brandPromotionBanner.id,
        undefined,
        'title',
      ),
    ]);

    const titleTextsByEntityAndLanguage = MultilingualFieldDto.fromByEntityList(
      multilingualTexts,
      'title',
    );

    const nameDto = languages.map((language) =>
      AdminBrandPromotionBannerLanguageDto.from(
        language.code,
        titleTextsByEntityAndLanguage.getContentByLanguage(language.code),
      ),
    );

    return GetAdminBrandPromotionBannerDetailResponse.from(
      brandPromotionBanner,
      nameDto,
    );
  }

  @Transactional()
  async patchBrandPromotionBanner(
    id: number,
    request: PatchAdminBrandPromotionBannerRequest,
  ) {
    await this.brandPromotionRepositoryService.getBrandPromotionBannerById(id);

    await this.brandPromotionRepositoryService.updateBrandPromotionBanner({
      id,
      brandPromotionId: request.brandPromotionId,
      linkUrl: request.linkUrl,
    });

    await this.languageRepositoryService.deleteMultilingualTexts(
      EntityType.BRAND_PROMOTION_BANNER,
      id,
    );

    await Promise.all(
      request.language.map(async (language) => {
        const languageId =
          await this.languageRepositoryService.findLanguageByCode(
            language.languageCode,
          );

        await this.languageRepositoryService.saveMultilingualText(
          EntityType.BRAND_PROMOTION_BANNER,
          id,
          'title',
          languageId.id,
          language.title,
        );
      }),
    );

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
    await this.brandPromotionRepositoryService.deleteBrandPromotionBannerWithMultilingual(
      id,
    );
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

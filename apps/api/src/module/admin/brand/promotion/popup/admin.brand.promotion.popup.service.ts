/* eslint-disable max-lines-per-function */
import { BrandPromotionPopupImageEntity } from '@app/repository/entity/brand-promotion-popup-image.entity';
import { BrandPromotionPopupEntity } from '@app/repository/entity/brand-promotion-popup.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { BrandPromotionRepositoryService } from '@app/repository/service/brand-promotion.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  GetAdminBrandPromotionPopupDetailResponse,
  GetAdminBrandPromotionPopupLanguageDto,
  GetAdminBrandPromotionPopupListRequest,
  GetAdminBrandPromotionPopupResponse,
  PostAdminBrandPromotionPopupRequest,
} from './admin.brand.promotion.popup.dto';

@Injectable()
export class AdminBrandPromotionPopupService {
  constructor(
    private readonly brandPromotionRepositoryService: BrandPromotionRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  @Transactional()
  async createBrandPromotionPopup(
    request: PostAdminBrandPromotionPopupRequest,
  ) {
    const entity =
      await this.brandPromotionRepositoryService.createBrandPromotionPopup(
        plainToInstance(BrandPromotionPopupEntity, {
          brandPromotionId: request.brandPromotionId,
          place: request.place,
          address: request.address,
          latitude: request.latitude,
          longitude: request.longitude,
          startDate: request.startDate,
          endDate: request.endDate,
          isActive: request.isActive,
        }),
      );

    await Promise.all(
      request.language.map(async (language) => {
        await this.languageRepositoryService.saveMultilingualText(
          EntityType.BRAND_PROMOTION_POPUP,
          entity.id,
          'title',
          language.languageId,
          language.title,
        );

        await this.languageRepositoryService.saveMultilingualText(
          EntityType.BRAND_PROMOTION_POPUP,
          entity.id,
          'description',
          language.languageId,
          language.description,
        );
      }),
    );

    await Promise.all(
      request.imagePathList.map((imagePath) =>
        this.brandPromotionRepositoryService.createBrandPromotionPopupImage(
          plainToInstance(BrandPromotionPopupImageEntity, {
            brandPromotionPopupId: entity.id,
            imagePath,
          }),
        ),
      ),
    );
  }

  async getBrandPromotionPopupList(
    request: GetAdminBrandPromotionPopupListRequest,
  ): Promise<[GetAdminBrandPromotionPopupResponse[], number]> {
    const [brandPromotionPopups, total] =
      await this.brandPromotionRepositoryService.findBrandPromotionPopupListByPaging(
        request.page,
        request.count,
      );

    const languages =
      await this.languageRepositoryService.findAllActiveLanguages();

    const brandPromotionPopupList = await Promise.all(
      brandPromotionPopups.map(async (brandPromotionPopup) => {
        const nameDto = await Promise.all(
          languages.map(async (language) => {
            const multilingualTitleText =
              await this.languageRepositoryService.findMultilingualTexts(
                EntityType.BRAND_PROMOTION_POPUP,
                brandPromotionPopup.id,
                language.code,
                'title',
              );

            const multilingualDescription =
              await this.languageRepositoryService.findMultilingualTexts(
                EntityType.BRAND_PROMOTION_POPUP,
                brandPromotionPopup.id,
                language.code,
                'description',
              );

            if (
              multilingualTitleText.length > 0 &&
              multilingualDescription.length > 0
            ) {
              return GetAdminBrandPromotionPopupLanguageDto.from(
                language.code,
                multilingualTitleText[0].textContent,
                multilingualDescription[0].textContent,
              );
            }
            return null;
          }),
        );
        return GetAdminBrandPromotionPopupResponse.from(
          brandPromotionPopup,
          nameDto,
        );
      }),
    );

    return [brandPromotionPopupList, total];
  }

  async getBrandPromotionPopupDetail(
    id: number,
  ): Promise<GetAdminBrandPromotionPopupDetailResponse> {
    const brandPromotionPopup =
      await this.brandPromotionRepositoryService.getBrandPromotionPopupById(id);
    const languages =
      await this.languageRepositoryService.findAllActiveLanguages();

    const nameDto = await Promise.all(
      languages.map(async (language) => {
        const multilingualTitleText =
          await this.languageRepositoryService.findMultilingualTexts(
            EntityType.BRAND_PROMOTION_POPUP,
            brandPromotionPopup.id,
            language.code,
            'title',
          );

        const multilingualDescription =
          await this.languageRepositoryService.findMultilingualTexts(
            EntityType.BRAND_PROMOTION_POPUP,
            brandPromotionPopup.id,
            language.code,
            'description',
          );

        if (
          multilingualTitleText.length > 0 &&
          multilingualDescription.length > 0
        ) {
          return GetAdminBrandPromotionPopupLanguageDto.from(
            language.code,
            multilingualTitleText[0].textContent,
            multilingualDescription[0].textContent,
          );
        }
        return null;
      }),
    );

    return GetAdminBrandPromotionPopupDetailResponse.from(
      brandPromotionPopup,
      nameDto,
    );
  }
}

/* eslint-disable max-lines-per-function */
import { Configuration } from '@app/config/configuration';
import { BrandPromotionPopupImageEntity } from '@app/repository/entity/brand-promotion-popup-image.entity';
import { BrandPromotionPopupEntity } from '@app/repository/entity/brand-promotion-popup.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { BrandPromotionRepositoryService } from '@app/repository/service/brand-promotion.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';
import { MultilingualFieldDto } from 'apps/api/src/module/dto/multilingual.dto';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  GetAdminBrandPromotionPopupDetailResponse,
  GetAdminBrandPromotionPopupLanguageDto,
  GetAdminBrandPromotionPopupListRequest,
  GetAdminBrandPromotionPopupResponse,
  PatchAdminBrandPromotionPopupRequest,
  PostAdminBrandPromotionPopupLanguageDto,
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
    await this.brandPromotionRepositoryService.getBrandPromotionById(
      request.brandPromotionId,
    );

    const entity =
      await this.brandPromotionRepositoryService.createBrandPromotionPopup(
        plainToInstance(BrandPromotionPopupEntity, {
          brandPromotionId: request.brandPromotionId,
          place: request.place,
          address: request.address,
          latitude: request.latitude,
          longitude: request.longitude,
          startDate: request.startDate,
          startTime: request.startTime,
          endDate: request.endDate,
          endTime: request.endTime,
          isActive: request.isActive,
        }),
      );

    await this.createBrandPromotionPopupMultilingualText(
      entity.id,
      request.language,
    );

    await this.createBrandPromotionPopupImageList(
      entity.id,
      request.imagePathList,
    );
  }

  async getBrandPromotionPopupList(
    request: GetAdminBrandPromotionPopupListRequest,
  ): Promise<[GetAdminBrandPromotionPopupResponse[], number]> {
    const [brandPromotionPopups, total] =
      await this.brandPromotionRepositoryService.findBrandPromotionPopupListByPaging(
        request.page,
        request.count,
        request.brandPromotionId,
      );

    if (brandPromotionPopups.length === 0) {
      return [[], total];
    }

    const [languages, multilingualTexts] = await Promise.all([
      this.languageRepositoryService.findAllActiveLanguages(),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND_PROMOTION_POPUP,
        brandPromotionPopups.map((b) => b.id),
      ),
    ]);

    const brandPromotionPopupList = brandPromotionPopups.map(
      (brandPromotionPopup) => {
        const titleByEntityAndLanguage = MultilingualFieldDto.fromByEntity(
          multilingualTexts.filter(
            (v) => v.entityId === brandPromotionPopup.id,
          ),
          'title',
        );
        const descriptionByEntityAndLanguage =
          MultilingualFieldDto.fromByEntity(
            multilingualTexts.filter(
              (v) => v.entityId === brandPromotionPopup.id,
            ),
            'description',
          );
        const nameDto = languages.map((language) =>
          GetAdminBrandPromotionPopupLanguageDto.from(
            language.code,
            titleByEntityAndLanguage.getContentByLanguage(language.code),
            descriptionByEntityAndLanguage.getContentByLanguage(language.code),
          ),
        );
        return GetAdminBrandPromotionPopupResponse.from(
          brandPromotionPopup,
          nameDto,
        );
      },
    );

    return [brandPromotionPopupList, total];
  }

  async getBrandPromotionPopupDetail(
    id: number,
  ): Promise<GetAdminBrandPromotionPopupDetailResponse> {
    const brandPromotionPopup =
      await this.brandPromotionRepositoryService.getBrandPromotionPopupById(id);

    const [languages, multilingualTexts] = await Promise.all([
      this.languageRepositoryService.findAllActiveLanguages(),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND_PROMOTION_POPUP,
        [brandPromotionPopup.id],
      ),
    ]);

    const titleByEntityAndLanguage = MultilingualFieldDto.fromByEntity(
      multilingualTexts,
      'title',
    );
    const descriptionByEntityAndLanguage = MultilingualFieldDto.fromByEntity(
      multilingualTexts,
      'description',
    );

    const nameDto = languages.map((language) =>
      GetAdminBrandPromotionPopupLanguageDto.from(
        language.code,
        titleByEntityAndLanguage.getContentByLanguage(language.code),
        descriptionByEntityAndLanguage.getContentByLanguage(language.code),
      ),
    );

    return GetAdminBrandPromotionPopupDetailResponse.from(
      brandPromotionPopup,
      nameDto,
    );
  }

  @Transactional()
  async patchBrandPromotionPopup(
    id: number,
    request: PatchAdminBrandPromotionPopupRequest,
  ) {
    await this.brandPromotionRepositoryService.getBrandPromotionPopupById(id);

    await this.brandPromotionRepositoryService.updateBrandPromotionPopup({
      id,
      brandPromotionId: request.brandPromotionId,
      place: request.place,
      address: request.address,
      latitude: request.latitude,
      longitude: request.longitude,
      startDate: new Date(request.startDate),
      endDate: request.endDate ? new Date(request.endDate) : null,
      isActive: request.isActive,
    });

    await this.createBrandPromotionPopupMultilingualText(id, request.language);

    await this.createBrandPromotionPopupImageList(id, request.imageUrlList);
  }

  async deleteBrandPromotionPopup(id: number) {
    await this.brandPromotionRepositoryService.deleteBrandPromotionPopup(id);
    await this.languageRepositoryService.deleteMultilingualTexts(
      EntityType.BRAND_PROMOTION_POPUP,
      id,
    );
  }

  private async createBrandPromotionPopupMultilingualText(
    entityId: number,
    language:
      | GetAdminBrandPromotionPopupLanguageDto[]
      | PostAdminBrandPromotionPopupLanguageDto[],
  ) {
    await this.languageRepositoryService.deleteMultilingualTexts(
      EntityType.BRAND_PROMOTION_POPUP,
      entityId,
    );
    await Promise.all(
      language.map(async (language) => {
        let languageId = language?.languageId;

        const languageEntity = language?.languageCode
          ? await this.languageRepositoryService.findLanguageByCode(
              language.languageCode,
            )
          : null;

        if (languageEntity) {
          languageId = languageEntity.id;
        }

        await this.languageRepositoryService.saveMultilingualText(
          EntityType.BRAND_PROMOTION_POPUP,
          entityId,
          'title',
          languageId,
          language.title,
        );

        await this.languageRepositoryService.saveMultilingualText(
          EntityType.BRAND_PROMOTION_POPUP,
          entityId,
          'description',
          languageId,
          language.description,
        );
      }),
    );
  }

  private async createBrandPromotionPopupImageList(
    entityId: number,
    imageList: string[],
  ) {
    await this.brandPromotionRepositoryService.deleteBrandPromotionPopupImageByBrandPromotionPopupId(
      entityId,
    );

    await Promise.all(
      imageList.map((image) =>
        this.brandPromotionRepositoryService.createBrandPromotionPopupImage(
          plainToInstance(BrandPromotionPopupImageEntity, {
            brandPromotionPopupId: entityId,
            imagePath: image.replace(
              Configuration.getConfig().IMAGE_DOMAIN_NAME,
              '',
            ),
          }),
        ),
      ),
    );
  }
}

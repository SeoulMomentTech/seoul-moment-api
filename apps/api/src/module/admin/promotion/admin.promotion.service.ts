import { PromotionEntity } from '@app/repository/entity/promotion.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { BrandPromotionRepositoryService } from '@app/repository/service/brand-promotion.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  GetAdminPromotionLanguageDto,
  GetAdminPromotionListRequest,
  GetAdminPromotionResponse,
  PostAdminPromotionLanguageDto,
  PostAdminPromotionRequest,
} from './admin.promotion.dto';
import { MultilingualFieldDto } from '../../dto/multilingual.dto';

@Injectable()
export class AdminPromotionService {
  constructor(
    private readonly brandPromotionRepositoryService: BrandPromotionRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  @Transactional()
  async createPromotion(request: PostAdminPromotionRequest) {
    const entity = await this.brandPromotionRepositoryService.createPromotion(
      plainToInstance(PromotionEntity, {
        bannerImagePath: request.bannerImagePath,
        bannerMobileImagePath: request.bannerMobileImagePath,
        thumbnailImagePath: request.thumbnailImagePath,
        startDate: new Date(request.startDate),
        endDate: new Date(request.endDate),
      }),
    );

    await this.createPromotionMultilingualText(entity.id, request.language);
  }

  async getPromotionList(
    request: GetAdminPromotionListRequest,
  ): Promise<[GetAdminPromotionResponse[], number]> {
    const [promotionList, total] =
      await this.brandPromotionRepositoryService.findPromotionListByPaging(
        request.page,
        request.count,
        request.search,
      );

    if (promotionList.length === 0) {
      return [[], total];
    }

    const languages =
      await this.languageRepositoryService.findAllActiveLanguages();

    const multilingualTexts =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.PROMOTION,
        promotionList.map((promotion) => promotion.id),
      );

    const promotionListResponse = promotionList.map((promotion) => {
      const titleByEntityAndLanguage = MultilingualFieldDto.fromByEntity(
        multilingualTexts.filter((v) => v.entityId === promotion.id),
        'title',
      );

      const descriptionByEntityAndLanguage = MultilingualFieldDto.fromByEntity(
        multilingualTexts.filter((v) => v.entityId === promotion.id),
        'description',
      );

      return GetAdminPromotionResponse.from(
        promotion,
        languages.map((language) =>
          GetAdminPromotionLanguageDto.from(
            language.code,
            titleByEntityAndLanguage.getContentByLanguage(language.code),
            descriptionByEntityAndLanguage.getContentByLanguage(language.code),
          ),
        ),
      );
    });

    return [promotionListResponse, total];
  }

  private async createPromotionMultilingualText(
    entityId: number,
    language: GetAdminPromotionLanguageDto[] | PostAdminPromotionLanguageDto[],
  ) {
    await this.languageRepositoryService.deleteMultilingualTexts(
      EntityType.PROMOTION,
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
          EntityType.PROMOTION,
          entityId,
          'title',
          languageId,
          language.title,
        );

        await this.languageRepositoryService.saveMultilingualText(
          EntityType.PROMOTION,
          entityId,
          'description',
          languageId,
          language.description,
        );
      }),
    );
  }
}

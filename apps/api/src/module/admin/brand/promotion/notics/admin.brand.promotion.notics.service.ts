import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { BrandPromotionNoticeEntity } from '@app/repository/entity/brand-promotion-notice.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { BrandPromotionRepositoryService } from '@app/repository/service/brand-promotion.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';
import { MultilingualFieldDto } from 'apps/api/src/module/dto/multilingual.dto';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  GetAdminBrandPromotionNoticsDetailResponse,
  GetAdminBrandPromotionNoticsListRequest,
  GetAdminBrandPromotionNoticsResponse,
  PatchAdminBrandPromotionNoticsRequest,
  PostAdminBrandPromotionNoticsRequest,
  GetAdminBrandPromotionNoticsLanguageDto,
} from './admin.brand.promotion.notics.dto';

@Injectable()
export class AdminBrandPromotionNoticsService {
  constructor(
    private readonly brandPromotionRepositoryService: BrandPromotionRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  @Transactional()
  async createBrandPromotionNotics(
    request: PostAdminBrandPromotionNoticsRequest,
  ) {
    const entity =
      await this.brandPromotionRepositoryService.createBrandPromotionNotics(
        plainToInstance(BrandPromotionNoticeEntity, {
          brandPromotionId: request.brandPromotionId,
        }),
      );

    await Promise.all(
      request.language.map(async (language) =>
        this.languageRepositoryService.saveMultilingualText(
          EntityType.BRAND_PROMOTION_NOTICE,
          entity.id,
          'content',
          language.languageId,
          language.content,
        ),
      ),
    );
  }

  async getBrandPromotionNoticsList(
    request: GetAdminBrandPromotionNoticsListRequest,
  ): Promise<[GetAdminBrandPromotionNoticsResponse[], number]> {
    const [brandPromotionNotics, total] =
      await this.brandPromotionRepositoryService.findBrandPromotionNoticsListByPaging(
        request.page,
        request.count,
      );

    if (brandPromotionNotics.length === 0) {
      return [[], total];
    }

    const [languages, multilingualTexts] = await Promise.all([
      this.languageRepositoryService.findAllActiveLanguages(),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND_PROMOTION_NOTICE,
        brandPromotionNotics.map((b) => b.id),
      ),
    ]);

    const brandPromotionNoticsList = brandPromotionNotics.map(
      (brandPromotionNotics) => {
        const contentByEntity = MultilingualFieldDto.fromByEntity(
          multilingualTexts.filter(
            (v) => v.entityId === brandPromotionNotics.id,
          ),
          'content',
        );

        const nameDto = languages.map((language) =>
          GetAdminBrandPromotionNoticsLanguageDto.from(
            language.code,
            contentByEntity.getContentByLanguage(language.code),
          ),
        );

        return GetAdminBrandPromotionNoticsResponse.from(
          brandPromotionNotics,
          nameDto,
        );
      },
    );

    return [brandPromotionNoticsList, total];
  }

  @Transactional()
  async patchBrandPromotionNotics(
    id: number,
    request: PatchAdminBrandPromotionNoticsRequest,
  ) {
    await this.brandPromotionRepositoryService.getBrandPromotionById(
      request.brandPromotionId,
    );

    await this.brandPromotionRepositoryService.updateBrandPromotionNotics({
      id,
      brandPromotionId: request.brandPromotionId,
    });

    await this.languageRepositoryService.deleteMultilingualTexts(
      EntityType.BRAND_PROMOTION_NOTICE,
      id,
    );

    await Promise.all(
      request.language.map(async (language) => {
        const languageEntity =
          await this.languageRepositoryService.findLanguageByCode(
            language.languageCode,
          );

        if (!languageEntity) {
          throw new ServiceError(
            'not found language',
            ServiceErrorCode.NOT_FOUND_DATA,
          );
        }

        await this.languageRepositoryService.saveMultilingualText(
          EntityType.BRAND_PROMOTION_NOTICE,
          id,
          'content',
          languageEntity.id,
          language.content,
        );
      }),
    );
  }

  @Transactional()
  async deleteBrandPromotionNotics(id: number) {
    await this.brandPromotionRepositoryService.deleteBrandPromotionNotics(id);

    await this.languageRepositoryService.deleteMultilingualTexts(
      EntityType.BRAND_PROMOTION_NOTICE,
      id,
    );
  }

  async getBrandPromotionNoticsDetail(
    id: number,
  ): Promise<GetAdminBrandPromotionNoticsDetailResponse> {
    const brandPromotionNotics =
      await this.brandPromotionRepositoryService.getBrandPromotionNoticsById(
        id,
      );

    const [languages, multilingualTexts] = await Promise.all([
      this.languageRepositoryService.findAllActiveLanguages(),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND_PROMOTION_NOTICE,
        [brandPromotionNotics.id],
      ),
    ]);

    const contentByEntity = MultilingualFieldDto.fromByEntity(
      multilingualTexts,
      'content',
    );

    const contentDto = languages.map((language) =>
      GetAdminBrandPromotionNoticsLanguageDto.from(
        language.code,
        contentByEntity.getContentByLanguage(language.code),
      ),
    );

    return GetAdminBrandPromotionNoticsDetailResponse.from(
      brandPromotionNotics,
      contentDto,
    );
  }
}

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
  GetAdminBrandPromotionNoticeDetailResponse,
  GetAdminBrandPromotionNoticeListRequest,
  GetAdminBrandPromotionNoticeResponse,
  PatchAdminBrandPromotionNoticeRequest,
  PostAdminBrandPromotionNoticeRequest,
  GetAdminBrandPromotionNoticeLanguageDto,
} from './admin.brand.promotion.notice.dto';

@Injectable()
export class AdminBrandPromotionNoticeService {
  constructor(
    private readonly brandPromotionRepositoryService: BrandPromotionRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  @Transactional()
  async createBrandPromotionNotice(
    request: PostAdminBrandPromotionNoticeRequest,
  ) {
    const entity =
      await this.brandPromotionRepositoryService.createBrandPromotionNotice(
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

  async getBrandPromotionNoticeList(
    request: GetAdminBrandPromotionNoticeListRequest,
  ): Promise<[GetAdminBrandPromotionNoticeResponse[], number]> {
    const [brandPromotionNotice, total] =
      await this.brandPromotionRepositoryService.findBrandPromotionNoticeListByPaging(
        request.page,
        request.count,
      );

    if (brandPromotionNotice.length === 0) {
      return [[], total];
    }

    const [languages, multilingualTexts] = await Promise.all([
      this.languageRepositoryService.findAllActiveLanguages(),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND_PROMOTION_NOTICE,
        brandPromotionNotice.map((b) => b.id),
      ),
    ]);

    const brandPromotionNoticeList = brandPromotionNotice.map(
      (brandPromotionNotice) => {
        const contentByEntity = MultilingualFieldDto.fromByEntity(
          multilingualTexts.filter(
            (v) => v.entityId === brandPromotionNotice.id,
          ),
          'content',
        );

        const nameDto = languages.map((language) =>
          GetAdminBrandPromotionNoticeLanguageDto.from(
            language.code,
            contentByEntity.getContentByLanguage(language.code),
          ),
        );

        return GetAdminBrandPromotionNoticeResponse.from(
          brandPromotionNotice,
          nameDto,
        );
      },
    );

    return [brandPromotionNoticeList, total];
  }

  @Transactional()
  async patchBrandPromotionNotice(
    id: number,
    request: PatchAdminBrandPromotionNoticeRequest,
  ) {
    await this.brandPromotionRepositoryService.getBrandPromotionById(
      request.brandPromotionId,
    );

    await this.brandPromotionRepositoryService.updateBrandPromotionNotice({
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
  async deleteBrandPromotionNotice(id: number) {
    await this.brandPromotionRepositoryService.deleteBrandPromotionNotice(id);

    await this.languageRepositoryService.deleteMultilingualTexts(
      EntityType.BRAND_PROMOTION_NOTICE,
      id,
    );
  }

  async getBrandPromotionNoticeDetail(
    id: number,
  ): Promise<GetAdminBrandPromotionNoticeDetailResponse> {
    const brandPromotionNotice =
      await this.brandPromotionRepositoryService.getBrandPromotionNoticeById(
        id,
      );

    const [languages, multilingualTexts] = await Promise.all([
      this.languageRepositoryService.findAllActiveLanguages(),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND_PROMOTION_NOTICE,
        [brandPromotionNotice.id],
      ),
    ]);

    const contentByEntity = MultilingualFieldDto.fromByEntity(
      multilingualTexts,
      'content',
    );

    const contentDto = languages.map((language) =>
      GetAdminBrandPromotionNoticeLanguageDto.from(
        language.code,
        contentByEntity.getContentByLanguage(language.code),
      ),
    );

    return GetAdminBrandPromotionNoticeDetailResponse.from(
      brandPromotionNotice,
      contentDto,
    );
  }
}

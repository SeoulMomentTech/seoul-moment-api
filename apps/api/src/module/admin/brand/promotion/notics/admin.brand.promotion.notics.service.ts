import { BrandPromotionNoticeEntity } from '@app/repository/entity/brand-promotion-notice.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { BrandPromotionRepositoryService } from '@app/repository/service/brand-promotion.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  BrandPromotionNoticsLanguageDto,
  GetAdminBrandPromotionNoticsDetailResponse,
  GetAdminBrandPromotionNoticsListRequest,
  GetAdminBrandPromotionNoticsResponse,
  PatchAdminBrandPromotionNoticsRequest,
  PostAdminBrandPromotionNoticsRequest,
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

    const languages =
      await this.languageRepositoryService.findAllActiveLanguages();

    const brandPromotionNoticsList = await Promise.all(
      brandPromotionNotics.map(async (brandPromotionNotics) => {
        const multilingualTexts = await Promise.all(
          languages.map(async (language) =>
            this.languageRepositoryService.findMultilingualTexts(
              EntityType.BRAND_PROMOTION_NOTICE,
              brandPromotionNotics.id,
              language.code,
              'content',
            ),
          ),
        );

        return GetAdminBrandPromotionNoticsResponse.from(
          brandPromotionNotics,
          multilingualTexts.map((text) =>
            BrandPromotionNoticsLanguageDto.from(text[0]),
          ),
        );
      }),
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
      request.language.map(async (language) =>
        this.languageRepositoryService.saveMultilingualText(
          EntityType.BRAND_PROMOTION_NOTICE,
          id,
          'content',
          language.languageId,
          language.content,
        ),
      ),
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

    const languages =
      await this.languageRepositoryService.findAllActiveLanguages();

    const multilingualTexts = await Promise.all(
      languages.map(async (language) =>
        this.languageRepositoryService.findMultilingualTexts(
          EntityType.BRAND_PROMOTION_NOTICE,
          brandPromotionNotics.id,
          language.code,
          'content',
        ),
      ),
    );

    return GetAdminBrandPromotionNoticsDetailResponse.from(
      brandPromotionNotics,
      multilingualTexts.map((text) =>
        BrandPromotionNoticsLanguageDto.from(text[0]),
      ),
    );
  }
}

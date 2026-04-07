/* eslint-disable max-lines-per-function */
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Configuration } from '@app/config/configuration';
import { BrandPromotionEventCouponEntity } from '@app/repository/entity/brand-promotion-event-coupon.entity';
import { BrandPromotionEventEntity } from '@app/repository/entity/brand-promotion-event.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { BrandPromotionRepositoryService } from '@app/repository/service/brand-promotion.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';
import { MultilingualFieldDto } from 'apps/api/src/module/dto/multilingual.dto';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  GetAdminBrandPromotionEventCouponDetailResponse,
  GetAdminBrandPromotionEventCouponLanguageDto,
  GetAdminBrandPromotionEventCouponListRequest,
  GetAdminBrandPromotionEventCouponResponse,
  GetAdminBrandPromotionEventDetailResponse,
  GetAdminBrandPromotionEventLanguageDto,
  GetAdminBrandPromotionEventListRequest,
  GetAdminBrandPromotionEventResponse,
  PatchAdminBrandPromotionEventCouponRequest,
  PatchAdminBrandPromotionEventRequest,
  PostAdminBrandPromotionEventCouponLanguageDto,
  PostAdminBrandPromotionEventCouponRequest,
  PostAdminBrandPromotionEventRequest,
} from './admin.brand.promotion.event.dto';

@Injectable()
export class AdminBrandPromotionEventService {
  constructor(
    private readonly brandPromotionRepositoryService: BrandPromotionRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  @Transactional()
  async createBrandPromotionEvent(
    request: PostAdminBrandPromotionEventRequest,
  ): Promise<BrandPromotionEventEntity> {
    await this.brandPromotionRepositoryService.getBrandPromotionById(
      request.brandPromotionId,
    );

    const entity =
      await this.brandPromotionRepositoryService.createBrandPromotionEvent(
        plainToInstance(BrandPromotionEventEntity, {
          brandPromotionId: request.brandPromotionId,
          status: request.status,
        }),
      );

    await Promise.all(
      request.language.map(async (language) => {
        await this.languageRepositoryService.saveMultilingualText(
          EntityType.BRAND_PROMOTION_EVENT,
          entity.id,
          'title',
          language.languageId,
          language.title,
        );
      }),
    );

    return entity;
  }

  async getBrandPromotionEventList(
    request: GetAdminBrandPromotionEventListRequest,
  ): Promise<[GetAdminBrandPromotionEventResponse[], number]> {
    const [brandPromotionEvents, total] =
      await this.brandPromotionRepositoryService.findBrandPromotionEventListByPaging(
        request.page,
        request.count,
        request.brandPromotionId,
      );

    if (brandPromotionEvents.length === 0) {
      return [[], total];
    }

    const [languages, multilingualTexts] = await Promise.all([
      this.languageRepositoryService.findAllActiveLanguages(),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND_PROMOTION_EVENT,
        brandPromotionEvents.map((b) => b.id),
      ),
    ]);

    const brandPromotionEventList = brandPromotionEvents.map(
      (brandPromotionEvent) => {
        const titleTextsByEntityAndLanguage =
          MultilingualFieldDto.fromByEntityList(
            multilingualTexts.filter(
              (v) => v.entityId === brandPromotionEvent.id,
            ),
            'title',
          );

        const nameDto = languages.map((language) =>
          GetAdminBrandPromotionEventLanguageDto.from(
            language.code,
            titleTextsByEntityAndLanguage.getContentByLanguage(language.code),
          ),
        );

        return GetAdminBrandPromotionEventResponse.from(
          brandPromotionEvent,
          nameDto,
        );
      },
    );

    return [brandPromotionEventList, total];
  }

  async getBrandPromotionEventDetail(
    id: number,
  ): Promise<GetAdminBrandPromotionEventDetailResponse> {
    const brandPromotionEvent =
      await this.brandPromotionRepositoryService.getBrandPromotionEventById(id);

    const [languages, multilingualTexts] = await Promise.all([
      this.languageRepositoryService.findAllActiveLanguages(),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND_PROMOTION_EVENT,
        [brandPromotionEvent.id],
      ),
    ]);

    const titleTextsByEntityAndLanguage = MultilingualFieldDto.fromByEntityList(
      multilingualTexts,
      'title',
    );

    const nameDto = languages.map((language) =>
      GetAdminBrandPromotionEventLanguageDto.from(
        language.code,
        titleTextsByEntityAndLanguage.getContentByLanguage(language.code),
      ),
    );

    return GetAdminBrandPromotionEventDetailResponse.from(
      brandPromotionEvent,
      nameDto,
    );
  }

  @Transactional()
  async patchBrandPromotionEvent(
    id: number,
    request: PatchAdminBrandPromotionEventRequest,
  ) {
    await this.brandPromotionRepositoryService.getBrandPromotionEventById(id);

    await this.brandPromotionRepositoryService.updateBrandPromotionEvent({
      id,
      brandPromotionId: request.brandPromotionId,
      status: request.status,
    });

    await this.languageRepositoryService.deleteMultilingualTexts(
      EntityType.BRAND_PROMOTION_EVENT,
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
          EntityType.BRAND_PROMOTION_EVENT,
          id,
          'title',
          languageEntity.id,
          language.title,
        );
      }),
    );
  }

  @Transactional()
  async deleteBrandPromotionEvent(id: number) {
    await this.brandPromotionRepositoryService.deleteBrandPromotionEvent(id);

    await this.languageRepositoryService.deleteMultilingualTexts(
      EntityType.BRAND_PROMOTION_EVENT,
      id,
    );
  }

  async createBrandPromotionEventCoupon(
    request: PostAdminBrandPromotionEventCouponRequest,
  ) {
    const entity =
      await this.brandPromotionRepositoryService.createBrandPromotionEventCoupon(
        plainToInstance(BrandPromotionEventCouponEntity, {
          brandPromotionEventId: request.brandPromotionEventId,
          imagePath: request.imagePath,
        }),
      );

    await this.createBrandPromotionEventCouponMultilingualText(
      entity.id,
      request.language,
    );
  }

  async getBrandPromotionEventCouponList(
    request: GetAdminBrandPromotionEventCouponListRequest,
  ): Promise<[GetAdminBrandPromotionEventCouponResponse[], number]> {
    const [brandPromotionEventCoupons, total] =
      await this.brandPromotionRepositoryService.findBrandPromotionEventCouponListByPaging(
        request.page,
        request.count,
        request.brandPromotionEventId,
      );

    if (brandPromotionEventCoupons.length === 0) {
      return [[], total];
    }

    const [languages, multilingualTexts] = await Promise.all([
      this.languageRepositoryService.findAllActiveLanguages(),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND_PROMOTION_EVENT_COUPON,
        brandPromotionEventCoupons.map((b) => b.id),
      ),
    ]);

    const brandPromotionEventCouponList = brandPromotionEventCoupons.map(
      (brandPromotionEventCoupon) => {
        const titleTextsByEntityAndLanguage =
          MultilingualFieldDto.fromByEntityList(
            multilingualTexts.filter(
              (v) => v.entityId === brandPromotionEventCoupon.id,
            ),
            'title',
          );

        const descriptionTextsByEntityAndLanguage =
          MultilingualFieldDto.fromByEntityList(
            multilingualTexts.filter(
              (v) => v.entityId === brandPromotionEventCoupon.id,
            ),
            'description',
          );

        const nameDto = languages.map((language) =>
          GetAdminBrandPromotionEventCouponLanguageDto.from(
            language.code,
            titleTextsByEntityAndLanguage.getContentByLanguage(language.code),
            descriptionTextsByEntityAndLanguage.getContentByLanguage(
              language.code,
            ),
          ),
        );

        return GetAdminBrandPromotionEventCouponResponse.from(
          brandPromotionEventCoupon,
          nameDto,
        );
      },
    );

    return [brandPromotionEventCouponList, total];
  }

  async getBrandPromotionEventCouponDetail(
    id: number,
  ): Promise<GetAdminBrandPromotionEventCouponDetailResponse> {
    const brandPromotionEventCoupon =
      await this.brandPromotionRepositoryService.getBrandPromotionEventCouponById(
        id,
      );

    const [languages, multilingualTexts] = await Promise.all([
      this.languageRepositoryService.findAllActiveLanguages(),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND_PROMOTION_EVENT_COUPON,
        [brandPromotionEventCoupon.id],
      ),
    ]);

    const titleTextsByEntityAndLanguage = MultilingualFieldDto.fromByEntityList(
      multilingualTexts,
      'title',
    );

    const descriptionTextsByEntityAndLanguage =
      MultilingualFieldDto.fromByEntityList(multilingualTexts, 'description');

    const nameDto = languages.map((language) =>
      GetAdminBrandPromotionEventCouponLanguageDto.from(
        language.code,
        titleTextsByEntityAndLanguage.getContentByLanguage(language.code),
        descriptionTextsByEntityAndLanguage.getContentByLanguage(language.code),
      ),
    );

    return GetAdminBrandPromotionEventCouponDetailResponse.from(
      brandPromotionEventCoupon,
      nameDto,
    );
  }

  async patchBrandPromotionEventCoupon(
    id: number,
    request: PatchAdminBrandPromotionEventCouponRequest,
  ) {
    await this.brandPromotionRepositoryService.getBrandPromotionEventCouponById(
      id,
    );

    await this.createBrandPromotionEventCouponMultilingualText(
      id,
      request.language,
    );

    await this.brandPromotionRepositoryService.updateBrandPromotionEventCoupon({
      id,
      brandPromotionEventId: request.brandPromotionEventId,
      imagePath: request.imageUrl.replace(
        Configuration.getConfig().IMAGE_DOMAIN_NAME,
        '',
      ),
      status: request.status,
    });
  }

  @Transactional()
  async deleteBrandPromotionEventCoupon(id: number) {
    await this.brandPromotionRepositoryService.deleteBrandPromotionEventCoupon(
      id,
    );

    await this.languageRepositoryService.deleteMultilingualTexts(
      EntityType.BRAND_PROMOTION_EVENT_COUPON,
      id,
    );
  }

  private async createBrandPromotionEventCouponMultilingualText(
    entityId: number,
    language:
      | GetAdminBrandPromotionEventCouponLanguageDto[]
      | PostAdminBrandPromotionEventCouponLanguageDto[],
  ) {
    await this.languageRepositoryService.deleteMultilingualTexts(
      EntityType.BRAND_PROMOTION_EVENT_COUPON,
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
          EntityType.BRAND_PROMOTION_EVENT_COUPON,
          entityId,
          'title',
          languageId,
          language.title,
        );

        await this.languageRepositoryService.saveMultilingualText(
          EntityType.BRAND_PROMOTION_EVENT_COUPON,
          entityId,
          'description',
          languageId,
          language.description,
        );
      }),
    );
  }
}

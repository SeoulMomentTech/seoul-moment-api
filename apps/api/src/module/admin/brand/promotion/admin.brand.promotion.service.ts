/* eslint-disable max-lines-per-function */
import { BrandPromotionEntity } from '@app/repository/entity/brand-promotion.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { BrandPromotionRepositoryService } from '@app/repository/service/brand-promotion.repository.service';
import { BrandRepositoryService } from '@app/repository/service/brand.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  GetAdminBrandPromotionDetailResponse,
  GetAdminBrandPromotionEventAndCouponDto,
  GetAdminBrandPromotionLanguageDto,
  GetAdminBrandPromotionListRequest,
  GetAdminBrandPromotionResponse,
  PostAdminBrandPromotionEventAndCouponDto,
  PostAdminBrandPromotionLanguageDto,
  PostAdminBrandPromotionRequest,
} from './admin.brand.promotion.dto';
import {
  GetAdminBrandPromotionBannerRequest,
  PostAdminBrandPromotionBannerBaseDto,
  PostAdminBrandPromotionBannerRequest,
} from './banner/admin.brand.promotion.banner.dto';
import { AdminBrandPromotionBannerService } from './banner/admin.brand.promotion.banner.service';
import {
  GetAdminBrandPromotionEventCouponListRequest,
  GetAdminBrandPromotionEventListRequest,
  PostAdminBrandPromotionEventCouponRequest,
  PostAdminBrandPromotionEventRequest,
} from './event/admin.brand.promotion.event.dto';
import { AdminBrandPromotionEventService } from './event/admin.brand.promotion.event.service';
import {
  PostAdminBrandPromotionNoticsBaseDto,
  PostAdminBrandPromotionNoticsRequest,
} from './notics/admin.brand.promotion.notics.dto';
import { AdminBrandPromotionNoticsService } from './notics/admin.brand.promotion.notics.service';
import {
  GetAdminBrandPromotionPopupListRequest,
  PostAdminBrandPromotionPopupBaseDto,
  PostAdminBrandPromotionPopupRequest,
} from './popup/admin.brand.promotion.popup.dto';
import { AdminBrandPromotionPopupService } from './popup/admin.brand.promotion.popup.service';
import {
  GetAdminBrandPromotionSectionListRequest,
  PostAdminBrandPromotionSectionBaseDto,
  PostAdminBrandPromotionSectionRequest,
} from './section/admin.brand.promotion.section.dto';
import { AdminBrandPromotionSectionService } from './section/admin.brand.promotion.section.service';
import { MultilingualFieldDto } from '../../../dto/multilingual.dto';

@Injectable()
export class AdminBrandPromotionService {
  constructor(
    private readonly brandPromotionRepositoryService: BrandPromotionRepositoryService,
    private readonly brandRepositoryService: BrandRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
    private readonly adminBrandPromotionBannerService: AdminBrandPromotionBannerService,
    private readonly adminBrandPromotionSectionService: AdminBrandPromotionSectionService,
    private readonly adminBrandPromotionNoticsService: AdminBrandPromotionNoticsService,
    private readonly adminBrandPromotionPopupService: AdminBrandPromotionPopupService,
    private readonly adminBrandPromotionEventService: AdminBrandPromotionEventService,
  ) {}

  @Transactional()
  async createBrandPromotion(request: PostAdminBrandPromotionRequest) {
    await this.brandRepositoryService.getBrandById(request.brandId);

    const brandPromotionEntity =
      await this.brandPromotionRepositoryService.createBrandPromotion(
        plainToInstance(BrandPromotionEntity, {
          brandId: request.brandId,
          isActive: request.isActive,
        }),
      );

    await this.createBrandPromotionMultilingualText(
      brandPromotionEntity.id,
      request.brandDescriptionLanguage,
    );

    await Promise.all(
      request.bannerList.map((banner) =>
        this.createBrandPromotionBanner(brandPromotionEntity.id, banner),
      ),
    );

    await Promise.all(
      request.sectionList.map((section) =>
        this.createBrandPromotionSection(brandPromotionEntity.id, section),
      ),
    );

    await Promise.all(
      request.popupList.map((popup) =>
        this.createBrandPromotionPopup(brandPromotionEntity.id, popup),
      ),
    );

    if (request.noticeList && request.noticeList.length > 0) {
      await Promise.all(
        request.noticeList.map((notice) =>
          this.createBrandPromotionNotics(brandPromotionEntity.id, notice),
        ),
      );
    }

    if (request.eventAndCouponList && request.eventAndCouponList.length > 0) {
      await Promise.all(
        request.eventAndCouponList.map((eventAndCoupon) =>
          this.createBrandPromotionEventAndCoupon(
            brandPromotionEntity.id,
            eventAndCoupon,
          ),
        ),
      );
    }
  }

  private async createBrandPromotionEventAndCoupon(
    brandPromotionId: number,
    eventAndCoupon: PostAdminBrandPromotionEventAndCouponDto,
  ) {
    const eventEntity =
      await this.adminBrandPromotionEventService.createBrandPromotionEvent(
        plainToInstance(PostAdminBrandPromotionEventRequest, {
          brandPromotionId,
          ...eventAndCoupon.event,
        }),
      );

    await Promise.all(
      eventAndCoupon.coupon.map((coupon) =>
        this.adminBrandPromotionEventService.createBrandPromotionEventCoupon(
          plainToInstance(PostAdminBrandPromotionEventCouponRequest, {
            brandPromotionEventId: eventEntity.id,
            ...coupon,
          }),
        ),
      ),
    );
  }

  private async createBrandPromotionNotics(
    brandPromotionId: number,
    notice: PostAdminBrandPromotionNoticsBaseDto,
  ) {
    await this.adminBrandPromotionNoticsService.createBrandPromotionNotics(
      plainToInstance(PostAdminBrandPromotionNoticsRequest, {
        brandPromotionId,
        ...notice,
      }),
    );
  }
  private async createBrandPromotionSection(
    brandPromotionId: number,
    section: PostAdminBrandPromotionSectionBaseDto,
  ) {
    await this.adminBrandPromotionSectionService.createBrandPromotionSection(
      plainToInstance(PostAdminBrandPromotionSectionRequest, {
        brandPromotionId,
        ...section,
      }),
    );
  }

  private async createBrandPromotionBanner(
    brandPromotionId: number,
    banner: PostAdminBrandPromotionBannerBaseDto,
  ) {
    await this.adminBrandPromotionBannerService.createBrandPromotionBanner(
      plainToInstance(PostAdminBrandPromotionBannerRequest, {
        brandPromotionId,
        ...banner,
      }),
    );
  }

  private async createBrandPromotionPopup(
    brandPromotionId: number,
    popup: PostAdminBrandPromotionPopupBaseDto,
  ) {
    await this.adminBrandPromotionPopupService.createBrandPromotionPopup(
      plainToInstance(PostAdminBrandPromotionPopupRequest, {
        brandPromotionId,
        ...popup,
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

    const [bannerList] =
      await this.adminBrandPromotionBannerService.getBrandPromotionBannerList(
        plainToInstance(GetAdminBrandPromotionBannerRequest, {
          page: 1,
          count: 1000,
          brandPromotionId: id,
        }),
      );

    const [sectionList] =
      await this.adminBrandPromotionSectionService.getBrandPromotionSectionList(
        plainToInstance(GetAdminBrandPromotionSectionListRequest, {
          page: 1,
          count: 1000,
          brandPromotionId: id,
        }),
      );

    const [popupList] =
      await this.adminBrandPromotionPopupService.getBrandPromotionPopupList(
        plainToInstance(GetAdminBrandPromotionPopupListRequest, {
          page: 1,
          count: 1000,
          brandPromotionId: id,
        }),
      );

    const descriptionDto = await this.getBrandPromotionMultilingualText(id);

    const [eventList] =
      await this.adminBrandPromotionEventService.getBrandPromotionEventList(
        plainToInstance(GetAdminBrandPromotionEventListRequest, {
          page: 1,
          count: 1000,
          brandPromotionId: id,
        }),
      );

    const eventAndCouponList = await Promise.all(
      eventList.map(async (event) => {
        const [couponList] =
          await this.adminBrandPromotionEventService.getBrandPromotionEventCouponList(
            plainToInstance(GetAdminBrandPromotionEventCouponListRequest, {
              page: 1,
              count: 1000,
              brandPromotionEventId: event.id,
            }),
          );

        return GetAdminBrandPromotionEventAndCouponDto.from(event, couponList);
      }),
    );

    return GetAdminBrandPromotionDetailResponse.from(
      brandPromotion,
      bannerList,
      descriptionDto,
      sectionList,
      popupList,
      eventAndCouponList,
    );
  }

  async deleteBrandPromotion(id: number) {
    await this.brandPromotionRepositoryService.deleteBrandPromotion(id);
  }

  private async getBrandPromotionMultilingualText(
    entityId: number,
  ): Promise<GetAdminBrandPromotionLanguageDto[]> {
    const [languages, multilingualTexts] = await Promise.all([
      this.languageRepositoryService.findAllActiveLanguages(),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND_PROMOTION,
        [entityId],
      ),
    ]);

    const descriptionByEntityAndLanguage = MultilingualFieldDto.fromByEntity(
      multilingualTexts,
      'description',
    );

    return languages.map((language) =>
      GetAdminBrandPromotionLanguageDto.from(
        language.code,
        descriptionByEntityAndLanguage.getContentByLanguage(language.code),
      ),
    );
  }

  private async createBrandPromotionMultilingualText(
    entityId: number,
    language:
      | GetAdminBrandPromotionLanguageDto[]
      | PostAdminBrandPromotionLanguageDto[],
  ) {
    await this.languageRepositoryService.deleteMultilingualTexts(
      EntityType.BRAND_PROMOTION,
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
          EntityType.BRAND_PROMOTION,
          entityId,
          'description',
          languageId,
          language.description,
        );
      }),
    );
  }
}

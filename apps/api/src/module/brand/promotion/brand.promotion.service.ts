/* eslint-disable max-lines-per-function */
import { PagingDto } from '@app/common/dto/global.dto';
import { BrandPromotionEntity } from '@app/repository/entity/brand-promotion.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { BrandPromotionRepositoryService } from '@app/repository/service/brand-promotion.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { Injectable } from '@nestjs/common';

import {
  GetBrandPromotionBannerResponse,
  GetBrandPromotionBrandDetailResponse,
  GetBrandPromotionBrandResponse,
  GetBrandPromotionEventAndCouponResponse,
  GetBrandPromotionEventCouponResponse,
  GetBrandPromotionNoticsResponse,
  GetBrandPromotionPopupResponse,
  GetBrandPromotionProductResponse,
  GetBrandPromotionResponse,
  GetBrandPromotionSectionResponse,
} from './brand.promotion.dto';

@Injectable()
export class BrandPromotionService {
  constructor(
    private readonly brandPromotionRepositoryService: BrandPromotionRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
    private readonly productRepositoryService: ProductRepositoryService,
  ) {}

  async getBrandPromotionList(): Promise<GetBrandPromotionBrandResponse[]> {
    const brandPromotions =
      await this.brandPromotionRepositoryService.findBrandPromotionList();

    return brandPromotions.map((brandPromotion) =>
      GetBrandPromotionBrandResponse.from(brandPromotion),
    );
  }

  async getBrandPromotionDetail(
    brandId: number,
    language: LanguageCode,
  ): Promise<GetBrandPromotionResponse> {
    const brandPromotion =
      await this.brandPromotionRepositoryService.getBrandPromotionByBrandId(
        brandId,
      );

    const [
      brandPromotionBannerList,
      brandPromotionBrandDetail,
      brandPromotionSectionList,
      brandPromotionProductList,
      brandPromotionPopupList,
      brandPromotionEventList,
      brandPromotionNoticsList,
    ] = await Promise.all([
      this.getBrandPromotionBannerList(brandPromotion, language),
      this.getBrandPromotionBrandDetail(brandPromotion, language),
      this.getBrandPromotionSectionList(brandPromotion),
      this.getBrandPromotionProductList(brandId, language),
      this.getBrandPromotionPopupList(brandPromotion, language),
      this.getBrandPromotionEventList(brandPromotion, language),
      this.getBrandPromotionNoticsList(brandPromotion, language),
    ]);

    return GetBrandPromotionResponse.from(
      brandPromotionBannerList,
      brandPromotionBrandDetail,
      brandPromotionSectionList,
      brandPromotionProductList,
      brandPromotionPopupList,
      brandPromotionEventList,
      brandPromotionNoticsList,
    );
  }

  private async getBrandPromotionBannerList(
    brandPromotion: BrandPromotionEntity,
    language: LanguageCode,
  ): Promise<GetBrandPromotionBannerResponse[]> {
    const brandPromotionBanners =
      await this.brandPromotionRepositoryService.findBrandPromotionBannerListByBrandPromotionId(
        brandPromotion.id,
      );

    if (brandPromotionBanners.length === 0) {
      return [];
    }

    const multilingualTexts =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND_PROMOTION_BANNER,
        brandPromotionBanners.map((b) => b.id),
        language,
      );

    const multilingualTextsByBannerId =
      this.groupMultilingualTextsByEntityId(multilingualTexts);

    return brandPromotionBanners.map((brandPromotionBanner) =>
      GetBrandPromotionBannerResponse.from(
        brandPromotionBanner,
        multilingualTextsByBannerId.get(brandPromotionBanner.id) ?? [],
      ),
    );
  }

  private groupMultilingualTextsByEntityId(
    texts: MultilingualTextEntity[],
  ): Map<number, MultilingualTextEntity[]> {
    const map = new Map<number, MultilingualTextEntity[]>();
    for (const text of texts) {
      const list = map.get(text.entityId) ?? [];
      list.push(text);
      map.set(text.entityId, list);
    }
    return map;
  }

  private async getBrandPromotionBrandDetail(
    brandPromotion: BrandPromotionEntity,
    language: LanguageCode,
  ): Promise<GetBrandPromotionBrandDetailResponse> {
    const multilingualTexts =
      await this.languageRepositoryService.findMultilingualTexts(
        EntityType.BRAND_PROMOTION,
        brandPromotion.id,
        language,
      );

    return GetBrandPromotionBrandDetailResponse.from(
      brandPromotion,
      multilingualTexts,
    );
  }

  private async getBrandPromotionSectionList(
    brandPromotion: BrandPromotionEntity,
  ): Promise<GetBrandPromotionSectionResponse[]> {
    const brandPromotionSections =
      await this.brandPromotionRepositoryService.findBrandPromotionSectionListByBrandPromotionId(
        brandPromotion.id,
      );

    return brandPromotionSections.map((brandPromotionSection) =>
      GetBrandPromotionSectionResponse.from(brandPromotionSection),
    );
  }

  private async getBrandPromotionProductList(
    brandId: number,
    language: LanguageCode,
  ): Promise<GetBrandPromotionProductResponse[]> {
    const [productItemList] =
      await this.productRepositoryService.findProductItem(
        PagingDto.from(1, 10),
        undefined,
        brandId,
        undefined,
        undefined,
        undefined,
      );

    const [brandText, productText] = await Promise.all([
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND,
        productItemList.map((v) => v.product.brand.id),
        language,
      ),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.PRODUCT,
        productItemList.map((v) => v.product.id),
        language,
      ),
    ]);

    return productItemList.map((v) =>
      GetBrandPromotionProductResponse.from(v, {
        brand: brandText,
        product: productText,
      }),
    );
  }

  private async getBrandPromotionPopupList(
    brandPromotion: BrandPromotionEntity,
    language: LanguageCode,
  ): Promise<GetBrandPromotionPopupResponse[]> {
    const [brandPromotionPopupList] =
      await this.brandPromotionRepositoryService.findBrandPromotionPopupListByPaging(
        1,
        1000,
        brandPromotion.id,
      );

    if (brandPromotionPopupList.length === 0) {
      return [];
    }

    const multilingualTexts =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND_PROMOTION_POPUP,
        brandPromotionPopupList.map((v) => v.id),
        language,
      );

    const multilingualTextsByPopupId =
      this.groupMultilingualTextsByEntityId(multilingualTexts);

    return brandPromotionPopupList.map((brandPromotionPopup) =>
      GetBrandPromotionPopupResponse.from(
        brandPromotionPopup,
        multilingualTextsByPopupId.get(brandPromotionPopup.id) ?? [],
      ),
    );
  }

  private async getBrandPromotionEventList(
    brandPromotion: BrandPromotionEntity,
    language: LanguageCode,
  ): Promise<GetBrandPromotionEventAndCouponResponse[]> {
    const [brandPromotionEventList] =
      await this.brandPromotionRepositoryService.findBrandPromotionEventListByPaging(
        1,
        1000,
        brandPromotion.id,
      );

    if (brandPromotionEventList.length === 0) {
      return [];
    }

    const allCouponIds = brandPromotionEventList.flatMap((e) =>
      (e.coupons ?? []).map((c) => c.id),
    );

    const [eventMultilingualTexts, couponMultilingualTexts] = await Promise.all(
      [
        this.languageRepositoryService.findMultilingualTextsByEntities(
          EntityType.BRAND_PROMOTION_EVENT,
          brandPromotionEventList.map((v) => v.id),
          language,
        ),
        allCouponIds.length > 0
          ? this.languageRepositoryService.findMultilingualTextsByEntities(
              EntityType.BRAND_PROMOTION_EVENT_COUPON,
              allCouponIds,
              language,
            )
          : Promise.resolve([]),
      ],
    );

    const eventTextsByEntityId = this.groupMultilingualTextsByEntityId(
      eventMultilingualTexts,
    );
    const couponTextsByEntityId = this.groupMultilingualTextsByEntityId(
      couponMultilingualTexts,
    );

    return brandPromotionEventList.map((brandPromotionEvent) => {
      const couponList = (brandPromotionEvent.coupons ?? []).map((coupon) =>
        GetBrandPromotionEventCouponResponse.from(
          coupon,
          couponTextsByEntityId.get(coupon.id) ?? [],
        ),
      );

      return GetBrandPromotionEventAndCouponResponse.from(
        brandPromotionEvent,
        eventTextsByEntityId.get(brandPromotionEvent.id) ?? [],
        couponList,
      );
    });
  }

  private async getBrandPromotionNoticsList(
    brandPromotion: BrandPromotionEntity,
    language: LanguageCode,
  ): Promise<GetBrandPromotionNoticsResponse[]> {
    const [brandPromotionNotics] =
      await this.brandPromotionRepositoryService.findBrandPromotionNoticsListByPaging(
        1,
        1000,
        brandPromotion.id,
      );

    if (brandPromotionNotics.length === 0) {
      return [];
    }

    const multilingualTexts =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND_PROMOTION_NOTICE,
        brandPromotionNotics.map((v) => v.id),
        language,
      );

    const multilingualTextsByNoticeId =
      this.groupMultilingualTextsByEntityId(multilingualTexts);

    return brandPromotionNotics.map((notice) =>
      GetBrandPromotionNoticsResponse.from(
        notice,
        multilingualTextsByNoticeId.get(notice.id) ?? [],
      ),
    );
  }
}

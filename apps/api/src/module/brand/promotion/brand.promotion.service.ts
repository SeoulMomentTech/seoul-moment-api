/* eslint-disable max-lines-per-function */
import { PagingDto } from '@app/common/dto/global.dto';
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
    const brandPromotionBannerList = await this.getBrandPromotionBannerList(
      brandId,
      language,
    );

    const brandPromotionBrandDetail = await this.getBrandPromotionBrandDetail(
      brandId,
      language,
    );

    const brandPromotionSectionList =
      await this.getBrandPromotionSectionList(brandId);

    const brandPromotionProductList = await this.getBrandPromotionProductList(
      brandId,
      language,
    );

    const brandPromotionPopupList = await this.getBrandPromotionPopupList(
      brandId,
      language,
    );

    const brandPromotionEventList = await this.getBrandPromotionEventList(
      brandId,
      language,
    );

    const brandPromotionNoticsList = await this.getBrandPromotionNoticsList(
      brandId,
      language,
    );

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
    brandId: number,
    language: LanguageCode,
  ): Promise<GetBrandPromotionBannerResponse[]> {
    const brandPromotion =
      await this.brandPromotionRepositoryService.getBrandPromotionByBrandId(
        brandId,
      );

    const brandPromotionBanners =
      await this.brandPromotionRepositoryService.findBrandPromotionBannerListByBrandPromotionId(
        brandPromotion.id,
      );

    const brandPromotionBannerList = await Promise.all(
      brandPromotionBanners.map(async (brandPromotionBanner) => {
        const multilingualTexts =
          await this.languageRepositoryService.findMultilingualTexts(
            EntityType.BRAND_PROMOTION_BANNER,
            brandPromotionBanner.id,
            language,
          );

        return GetBrandPromotionBannerResponse.from(
          brandPromotionBanner,
          multilingualTexts,
        );
      }),
    );

    return brandPromotionBannerList;
  }

  private async getBrandPromotionBrandDetail(
    brandId: number,
    language: LanguageCode,
  ): Promise<GetBrandPromotionBrandDetailResponse> {
    const brandPromotion =
      await this.brandPromotionRepositoryService.getBrandPromotionByBrandId(
        brandId,
      );

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
    brandId: number,
  ): Promise<GetBrandPromotionSectionResponse[]> {
    const brandPromotion =
      await this.brandPromotionRepositoryService.getBrandPromotionByBrandId(
        brandId,
      );

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
    brandId: number,
    language: LanguageCode,
  ): Promise<GetBrandPromotionPopupResponse[]> {
    const brandPromotion =
      await this.brandPromotionRepositoryService.getBrandPromotionByBrandId(
        brandId,
      );

    const [brandPromotionPopupList] =
      await this.brandPromotionRepositoryService.findBrandPromotionPopupListByPaging(
        1,
        1000,
        brandPromotion.id,
      );

    const multilingualTexts =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND_PROMOTION_POPUP,
        brandPromotionPopupList.map((v) => v.id),
        language,
      );

    return brandPromotionPopupList.map((brandPromotionPopup) =>
      GetBrandPromotionPopupResponse.from(
        brandPromotionPopup,
        multilingualTexts,
      ),
    );
  }

  private async getBrandPromotionEventList(
    brandId: number,
    language: LanguageCode,
  ): Promise<GetBrandPromotionEventAndCouponResponse[]> {
    const brandPromotion =
      await this.brandPromotionRepositoryService.getBrandPromotionByBrandId(
        brandId,
      );

    const [brandPromotionEventList] =
      await this.brandPromotionRepositoryService.findBrandPromotionEventListByPaging(
        1,
        1000,
        brandPromotion.id,
      );

    const multilingualTexts =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND_PROMOTION_EVENT,
        brandPromotionEventList.map((v) => v.id),
        language,
      );

    return await Promise.all(
      brandPromotionEventList.map(async (brandPromotionEvent) => {
        const couponList = await Promise.all(
          brandPromotionEvent.coupons.map(async (v) => {
            const multilingualTexts =
              await this.languageRepositoryService.findMultilingualTexts(
                EntityType.BRAND_PROMOTION_EVENT_COUPON,
                v.id,
                language,
              );

            return GetBrandPromotionEventCouponResponse.from(
              v,
              multilingualTexts,
            );
          }),
        );

        return GetBrandPromotionEventAndCouponResponse.from(
          brandPromotionEvent,
          multilingualTexts,
          couponList,
        );
      }),
    );
  }

  private async getBrandPromotionNoticsList(
    brandId: number,
    language: LanguageCode,
  ): Promise<GetBrandPromotionNoticsResponse[]> {
    const brandPromotion =
      await this.brandPromotionRepositoryService.getBrandPromotionByBrandId(
        brandId,
      );

    const [brandPromotionNotics] =
      await this.brandPromotionRepositoryService.findBrandPromotionNoticsListByPaging(
        1,
        1000,
        brandPromotion.id,
      );

    const multilingualTexts =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.BRAND_PROMOTION_NOTICE,
        brandPromotionNotics.map((v) => v.id),
        language,
      );

    return brandPromotionNotics.map((brandPromotionNotics) =>
      GetBrandPromotionNoticsResponse.from(
        brandPromotionNotics,
        multilingualTexts,
      ),
    );
  }
}

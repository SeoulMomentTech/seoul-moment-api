import { RequireKey } from '@app/common/type/require-key.type';

import { BrandPromotionBannerEntity } from '../entity/brand-promotion-banner.entity';
import { BrandPromotionBannerImageEntity } from '../entity/brand-promotion-banner.image.entity';
import { BrandPromotionEventCouponEntity } from '../entity/brand-promotion-event-coupon.entity';
import { BrandPromotionEventEntity } from '../entity/brand-promotion-event.entity';
import { BrandPromotionNoticeEntity } from '../entity/brand-promotion-notice.entity';
import { BrandPromotionPopupEntity } from '../entity/brand-promotion-popup.entity';
import { BrandPromotionSectionImageEntity } from '../entity/brand-promotion-section-image.entity';
import { BrandPromotionSectionEntity } from '../entity/brand-promotion-section.entity';
import { BrandPromotionEntity } from '../entity/brand-promotion.entity';

export type UpdateBrandPromotionDto = RequireKey<BrandPromotionEntity, 'id'>;

export type UpdateBrandPromotionBannerDto = RequireKey<
  BrandPromotionBannerEntity,
  'id'
>;

export type UpdateBrandPromotionBannerImageDto = RequireKey<
  BrandPromotionBannerImageEntity,
  'id'
>;

export type UpdateBrandPromotionSectionDto = RequireKey<
  BrandPromotionSectionEntity,
  'id'
>;

export type UpdateBrandPromotionSectionImageDto = RequireKey<
  BrandPromotionSectionImageEntity,
  'id'
>;

export type UpdateBrandPromotionNoticsDto = RequireKey<
  BrandPromotionNoticeEntity,
  'id'
>;

export type UpdateBrandPromotionPopupDto = RequireKey<
  BrandPromotionPopupEntity,
  'id'
>;

export type UpdateBrandPromotionEventDto = RequireKey<
  BrandPromotionEventEntity,
  'id'
>;

export type UpdateBrandPromotionEventCouponDto = RequireKey<
  BrandPromotionEventCouponEntity,
  'id'
>;

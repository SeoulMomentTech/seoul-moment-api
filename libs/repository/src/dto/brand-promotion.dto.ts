import { RequireKey } from '@app/common/type/require-key.type';

import { BrandPromotionBannerEntity } from '../entity/brand-promotion-banner.entity';
import { BrandPromotionSectionImageEntity } from '../entity/brand-promotion-section-image.entity';
import { BrandPromotionSectionEntity } from '../entity/brand-promotion-section.entity';
import { BrandPromotionEntity } from '../entity/brand-promotion.entity';

export type UpdateBrandPromotionDto = RequireKey<BrandPromotionEntity, 'id'>;

export type UpdateBrandPromotionBannerDto = RequireKey<
  BrandPromotionBannerEntity,
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

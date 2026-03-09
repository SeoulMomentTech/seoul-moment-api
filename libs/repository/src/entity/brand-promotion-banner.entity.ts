import {
  PrimaryGeneratedColumn,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import { BrandPromotionBannerImageEntity } from './brand-promotion-banner.image.entity';
import { BrandPromotionEntity } from './brand-promotion.entity';
import { CommonEntity } from './common.entity';
import { MultilingualTextEntity } from './multilingual-text.entity';
import { EntityType } from '../enum/entity.enum';

/**
 * Multilgual column [title]
 */
@Entity(EntityType.BRAND_PROMOTION_BANNER)
export class BrandPromotionBannerEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'brand_promotion_id', nullable: false })
  brandPromotionId: number;

  @Column('varchar', { length: 500, nullable: true })
  linkUrl: string;

  @ManyToOne(
    () => BrandPromotionEntity,
    (brandPromotion) => brandPromotion.banners,
    {
      onDelete: 'CASCADE',
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  @JoinColumn({ name: 'brand_promotion_id' })
  brandPromotion: BrandPromotionEntity;

  @OneToMany(
    () => BrandPromotionBannerImageEntity,
    (image) => image.brandPromotionBanner,
    {
      cascade: true,
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  images: BrandPromotionBannerImageEntity[];

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];
}

import {
  PrimaryGeneratedColumn,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';

import { BrandPromotionBannerEntity } from './brand-promotion-banner.entity';
import { BrandPromotionEventEntity } from './brand-promotion-event.entity';
import { BrandPromotionNoticeEntity } from './brand-promotion-notice.entity';
import { BrandPromotionPopupEntity } from './brand-promotion-popup.entity';
import { BrandPromotionSectionEntity } from './brand-promotion-section.entity';
import { BrandEntity } from './brand.entity';
import { CommonEntity } from './common.entity';
import { MultilingualTextEntity } from './multilingual-text.entity';
import { EntityType } from '../enum/entity.enum';

/**
 * Multilgual column [description]
 */
@Entity(EntityType.BRAND_PROMOTION)
export class BrandPromotionEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'brand_id', nullable: false, unique: true })
  brandId: number;

  @Column('boolean', { default: true, nullable: false })
  isActive: boolean;

  @OneToOne(() => BrandEntity, (brand) => brand.promotions, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'brand_id' })
  brand: BrandEntity;

  @OneToMany(
    () => BrandPromotionBannerEntity,
    (banner) => banner.brandPromotion,
    {
      cascade: true,
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  banners: BrandPromotionBannerEntity[];

  @OneToMany(
    () => BrandPromotionSectionEntity,
    (section) => section.brandPromotion,
    {
      cascade: true,
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  sections: BrandPromotionSectionEntity[];

  @OneToMany(() => BrandPromotionPopupEntity, (popup) => popup.brandPromotion, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  popups: BrandPromotionPopupEntity[];

  @OneToMany(
    () => BrandPromotionNoticeEntity,
    (notice) => notice.brandPromotion,
    {
      cascade: true,
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  notices: BrandPromotionNoticeEntity[];

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];

  @OneToMany(() => BrandPromotionEventEntity, (event) => event.brandPromotion, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  events: BrandPromotionEventEntity[];
}

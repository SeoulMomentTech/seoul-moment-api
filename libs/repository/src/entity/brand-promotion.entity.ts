import {
  PrimaryGeneratedColumn,
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  ManyToOne,
} from 'typeorm';

import { BrandPromotionBannerEntity } from './brand-promotion-banner.entity';
import { BrandPromotionEventEntity } from './brand-promotion-event.entity';
import { BrandPromotionNoticeEntity } from './brand-promotion-notice.entity';
import { BrandPromotionPopupEntity } from './brand-promotion-popup.entity';
import { BrandPromotionSectionEntity } from './brand-promotion-section.entity';
import { BrandEntity } from './brand.entity';
import { CommonEntity } from './common.entity';
import { PromotionEntity } from './promotion.entity';
import { EntityType } from '../enum/entity.enum';

/**
 * Multilgual column [description]
 */
@Entity(EntityType.BRAND_PROMOTION)
export class BrandPromotionEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'promotion_id', nullable: true })
  promotionId: number;

  @Column('int', { name: 'brand_id', nullable: false })
  brandId: number;

  @Column('boolean', { default: true, nullable: false })
  isActive: boolean;

  @OneToMany(() => BrandEntity, (brand) => brand.promotions, {
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

  @OneToMany(() => BrandPromotionEventEntity, (event) => event.brandPromotion, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  events: BrandPromotionEventEntity[];

  @ManyToOne(() => PromotionEntity, (promotion) => promotion.brandPromotions, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'promotion_id' })
  promotion: PromotionEntity;
}

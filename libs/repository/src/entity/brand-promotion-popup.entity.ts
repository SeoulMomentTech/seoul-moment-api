import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BrandPromotionPopupImageEntity } from './brand-promotion-popup-image.entity';
import { BrandPromotionEntity } from './brand-promotion.entity';
import { CommonEntity } from './common.entity';
import { MultilingualTextEntity } from './multilingual-text.entity';
import { EntityType } from '../enum/entity.enum';

/**
 * Multilgual column [title, description]
 */
@Entity(EntityType.BRAND_PROMOTION_POPUP)
export class BrandPromotionPopupEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'brand_promotion_id', nullable: false })
  brandPromotionId: number;

  @Column('varchar', { length: 255, nullable: false })
  place: string;

  @Column('varchar', { length: 255, nullable: false })
  address: string;

  @Column('varchar', { length: 255, nullable: false })
  latitude: string;

  @Column('varchar', { length: 255, nullable: false })
  longitude: string;

  @Column('timestamp', { nullable: true })
  startDate: Date;

  @Column('timestamp', { nullable: true })
  endDate: Date;

  @Column('boolean', { default: true, nullable: false })
  isActive: boolean;

  @ManyToOne(
    () => BrandPromotionEntity,
    (brandPromotion) => brandPromotion.popups,
    {
      onDelete: 'CASCADE',
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  @JoinColumn({ name: 'brand_promotion_id' })
  brandPromotion: BrandPromotionEntity;

  @OneToMany(() => BrandPromotionPopupImageEntity, (image) => image.popup, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  images: BrandPromotionPopupImageEntity[];

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];
}

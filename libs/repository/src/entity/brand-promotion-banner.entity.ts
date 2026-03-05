import {
  PrimaryGeneratedColumn,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import { BrandPromotionEntity } from './brand-promotion.entity';
import { CommonEntity } from './common.entity';
import { MultilingualTextEntity } from './multilingual-text.entity';
import { DeviceType } from '../dto/common.dto';
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

  @Column('varchar', { length: 500, nullable: false })
  imagePath: string;

  @Column('varchar', { length: 500, nullable: true })
  linkUrl: string;

  @Column('enum', {
    enum: DeviceType,
    nullable: false,
    default: DeviceType.DESKTOP,
  })
  deviceType: DeviceType;

  @Column('timestamp', { nullable: false })
  startDate: Date;

  @Column('timestamp', { nullable: false })
  endDate: Date;

  @Column('int', { name: 'sort_order', default: 1, nullable: false })
  sortOrder: number;

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

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];
}

import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BrandPromotionSectionImageEntity } from './brand-promotion-section-image.entity';
import { BrandPromotionEntity } from './brand-promotion.entity';
import { CommonEntity } from './common.entity';
import { BrandPromotionSectionType } from '../enum/brand-promotion-section';

@Entity('brand_promotion_section')
export class BrandPromotionSectionEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'brand_promotion_id', nullable: false })
  brandPromotionId: number;

  @Column('enum', {
    enum: BrandPromotionSectionType,
    default: BrandPromotionSectionType.TYPE_1,
    nullable: false,
  })
  type: BrandPromotionSectionType;

  @Column('int', { name: 'sort_order', default: 1, nullable: false })
  sortOrder: number;

  @ManyToOne(
    () => BrandPromotionEntity,
    (brandPromotion) => brandPromotion.sections,
    {
      onDelete: 'CASCADE',
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  @JoinColumn({ name: 'brand_promotion_id' })
  brandPromotion: BrandPromotionEntity;

  @OneToMany(
    () => BrandPromotionSectionImageEntity,
    (image) => image.brandPromotionSection,
    {
      cascade: true,
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  images: BrandPromotionSectionImageEntity[];
}

import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BrandPromotionSectionImageEntity } from './brand-promotion-section-image.entity';
import { BrandPromotionSectionTypeEntity } from './brand-promotion-section-type.entity';
import { BrandPromotionEntity } from './brand-promotion.entity';
import { CommonEntity } from './common.entity';

@Entity('brand_promotion_section')
export class BrandPromotionSectionEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'brand_promotion_id', nullable: false })
  brandPromotionId: number;

  @Column('varchar', { name: 'type_id', nullable: false })
  typeId: string;

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

  @ManyToOne(() => BrandPromotionSectionTypeEntity, (type) => type.sections, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'type_id' })
  type: BrandPromotionSectionTypeEntity;
}

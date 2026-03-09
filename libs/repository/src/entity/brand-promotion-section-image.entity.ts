import { Configuration } from '@app/config/configuration';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BrandPromotionSectionEntity } from './brand-promotion-section.entity';
import { CommonEntity } from './common.entity';

@Entity('brand_promotion_section_image')
export class BrandPromotionSectionImageEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'brand_promotion_section_id', nullable: false })
  brandPromotionSectionId: number;

  @Column('varchar', { length: 500, nullable: false })
  imagePath: string;

  @ManyToOne(
    () => BrandPromotionSectionEntity,
    (brandPromotionSection) => brandPromotionSection.images,
    {
      onDelete: 'CASCADE',
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  @JoinColumn({ name: 'brand_promotion_section_id' })
  brandPromotionSection: BrandPromotionSectionEntity;

  getImageUrl(): string {
    return this.imagePath
      ? `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.imagePath}`
      : null;
  }
}

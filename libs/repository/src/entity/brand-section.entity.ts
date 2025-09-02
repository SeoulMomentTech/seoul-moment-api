import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BrandSectionImageEntity } from './brand-section-image.entity';
import { BrandEntity } from './brand.entity';
import { CommonEntity } from './common.entity';
import { MultilingualTextEntity } from './multilingual-text.entity';
import { EntityEnum } from '../enum/entity.enum';

@Entity(EntityEnum.BRAND_SECTION)
@Index(['brandId', 'sortOrder'])
export class BrandSectionEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'brand_id', nullable: false })
  brandId: number;

  @Column('int', { name: 'sort_order', default: 1, nullable: false })
  sortOrder: number;

  @ManyToOne(() => BrandEntity, (brand) => brand.section, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'brand_id' })
  brand: BrandEntity;

  @OneToMany(
    () => BrandSectionImageEntity,
    (brandSectionImage) => brandSectionImage.section,
    {
      cascade: true,
      eager: true,
    },
  )
  sectionImage: BrandSectionImageEntity[];

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];
}

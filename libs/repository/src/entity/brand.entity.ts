import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { BrandBannerImageEntity } from './brand-banner-image.entity';
import { BrandSectionEntity } from './brand-section.entity';
import { CommonEntity } from './common.entity';
import { MultilingualTextEntity } from './multilingual-text.entity';
import { BrandStatus } from '../enum/brand.enum';
import { EntityType } from '../enum/entity.enum';

@Entity(EntityType.BRAND)
export class BrandEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('enum', {
    enum: BrandStatus,
    default: BrandStatus.NORMAL,
    nullable: false,
  })
  status: BrandStatus;

  @OneToMany(
    () => BrandBannerImageEntity,
    (brandBannerImage) => brandBannerImage.brand,
    {
      cascade: true,
      eager: true,
    },
  )
  bannerImage: BrandBannerImageEntity[];

  @OneToMany(() => BrandSectionEntity, (brandSection) => brandSection.brand, {
    cascade: true,
    eager: true,
  })
  section: BrandSectionEntity[];

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];
}

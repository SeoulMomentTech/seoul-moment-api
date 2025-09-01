import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { BrandBannerImageEntity } from './brand-banner-image.entity';
import { BrandSectionEntity } from './brand-info-section.entity';
import { CommonEntity } from './common.entity';
import { MultilingualTextEntity } from './multilingual-text.entity';
import { BrandStatus } from '../enum/brand.enum';

@Entity('brand')
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
  brandBannerImageList: BrandBannerImageEntity[];

  @OneToMany(() => BrandSectionEntity, (brandSection) => brandSection.brand, {
    cascade: true,
    eager: true,
  })
  brandSectionList: BrandSectionEntity[];

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];
}

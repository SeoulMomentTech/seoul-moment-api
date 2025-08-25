import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { CommonEntity } from './common.entity';
import { BrandStatus } from '../enum/brand.enum';
import { BrandBannerImageEntity } from './brand-banner-image.entity';
import { BrandSectionEntity } from './brand-info-section.entity';

@Entity('brand')
export class BrandEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', { length: 100, nullable: false })
  name: string;

  @Column('text', { nullable: true })
  description: string;

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
}

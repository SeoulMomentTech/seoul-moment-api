import { Configuration } from '@app/config/configuration';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BrandEntity } from './brand.entity';
import { CommonEntity } from './common.entity';

@Entity('brand_banner_image')
@Index(['brandId', 'sortOrder'])
export class BrandBannerImageEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'brand_id', nullable: false })
  brandId: number;

  @Column('varchar', { name: 'image_url', length: 500, nullable: false })
  imageUrl: string;

  @Column('varchar', { name: 'mobile_image_url', length: 500, nullable: true })
  mobileImageUrl: string;

  @Column('int', { name: 'sort_order', default: 1, nullable: false })
  sortOrder: number;

  @ManyToOne(() => BrandEntity, (brand) => brand.bannerImage, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'brand_id' })
  brand: BrandEntity;

  getImage(): string {
    return `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.imageUrl}`;
  }

  getMobileImage(): string {
    return `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.mobileImageUrl}`;
  }
}

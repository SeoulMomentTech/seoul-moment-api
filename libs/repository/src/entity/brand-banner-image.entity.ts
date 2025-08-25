import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CommonEntity } from './common.entity';
import { BrandEntity } from './brand.entity';

@Entity('brand_banner_images')
@Index(['brandId', 'sortOrder'])
export class BrandBannerImageEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'brand_id', nullable: false })
  brandId: number;

  @Column('varchar', { name: 'image_url', length: 500, nullable: false })
  imageUrl: string;

  @Column('varchar', { name: 'alt_text', length: 200, nullable: true })
  altText: string;

  @Column('int', { name: 'sort_order', default: 1, nullable: false })
  sortOrder: number;

  @ManyToOne(() => BrandEntity, (brand) => brand.brandBannerImageList, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'brand_id' })
  brand: BrandEntity;
}

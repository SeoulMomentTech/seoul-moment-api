import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CommonEntity } from './common.entity';
import { BrandEntity } from './brand.entity';
import { BrandSectionImageEntity } from './brand-section-image.entity';

@Entity('brand_section')
@Index(['brandId', 'sortOrder'])
export class BrandSectionEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'brand_id', nullable: false })
  brandId: number;

  @Column('varchar', { length: 200, nullable: true })
  title: string;

  @Column('text', { nullable: true })
  content: string;

  @Column('int', { name: 'sort_order', default: 1, nullable: false })
  sortOrder: number;

  @ManyToOne(() => BrandEntity, (brand) => brand.brandSectionList, {
    onDelete: 'CASCADE',
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
  brandSectionImageList: BrandSectionImageEntity[];
}

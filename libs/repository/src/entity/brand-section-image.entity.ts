import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CommonEntity } from './common.entity';
import { BrandSectionEntity } from './brand-info-section.entity';

@Entity('brand_section_images')
@Index(['sectionId', 'sortOrder'])
export class BrandSectionImageEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'section_id', nullable: false })
  sectionId: number;

  @Column('varchar', { name: 'image_url', length: 500, nullable: false })
  imageUrl: string;

  @Column('varchar', { name: 'alt_text', length: 200, nullable: true })
  altText: string;

  @Column('int', { name: 'sort_order', default: 1, nullable: false })
  sortOrder: number;

  @ManyToOne(() => BrandSectionEntity, (section) => section.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'section_id' })
  section: BrandSectionEntity;
}

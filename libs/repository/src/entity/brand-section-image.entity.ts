import { Configuration } from '@app/config/configuration';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BrandSectionEntity } from './brand-info-section.entity';
import { CommonEntity } from './common.entity';

@Entity('brand_section_image')
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

  @ManyToOne(
    () => BrandSectionEntity,
    (section) => section.brandSectionImageList,
    {
      onDelete: 'CASCADE',
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  @JoinColumn({ name: 'section_id' })
  section: BrandSectionEntity;

  getImage(): string {
    return `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.imageUrl}`;
  }
}

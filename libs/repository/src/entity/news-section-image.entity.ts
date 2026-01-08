import { Configuration } from '@app/config/configuration';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { NewsSectionEntity } from './news-section.entity';

@Entity('news_section_image')
@Index(['sectionId', 'sortOrder'])
export class NewsSectionImageEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'section_id', nullable: false })
  sectionId: number;

  @Column('varchar', { name: 'image_url', length: 500, nullable: false })
  imageUrl: string;

  @Column('int', { name: 'sort_order', default: 1, nullable: false })
  sortOrder: number;

  @ManyToOne(() => NewsSectionEntity, (section) => section.sectionImage, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'section_id' })
  section: NewsSectionEntity;

  getImage(): string {
    return `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.imageUrl}`;
  }
}

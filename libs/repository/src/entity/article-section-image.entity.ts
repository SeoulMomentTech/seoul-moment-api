import { Configuration } from '@app/config/configuration';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ArticleSectionEntity } from './article-section.entity';
import { CommonEntity } from './common.entity';

@Entity('article_section_image')
@Index(['sectionId', 'sortOrder'])
export class ArticleSectionImageEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'section_id', nullable: false })
  sectionId: number;

  @Column('varchar', { name: 'image_url', length: 500, nullable: false })
  imageUrl: string;

  @Column('int', { name: 'sort_order', default: 1, nullable: false })
  sortOrder: number;

  @ManyToOne(
    () => ArticleSectionEntity,
    (section) => section.articleSectionImage,
    {
      onDelete: 'CASCADE',
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  @JoinColumn({ name: 'section_id' })
  section: ArticleSectionEntity;

  getImage(): string {
    return `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.imageUrl}`;
  }
}

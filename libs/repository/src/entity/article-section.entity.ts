import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ArticleSectionImageEntity } from './article-section-image.entity';
import { ArticleEntity } from './article.entity';
import { CommonEntity } from './common.entity';
import { MultilingualTextEntity } from './multilingual-text.entity';
import { EntityEnum } from '../enum/entity.enum';

@Entity(EntityEnum.ARTICLE_SECTION)
@Index(['articleId', 'sortOrder'])
export class ArticleSectionEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'article_id', nullable: false })
  articleId: number;

  @Column('int', { name: 'sort_order', default: 1, nullable: false })
  sortOrder: number;

  @ManyToOne(() => ArticleEntity, (article) => article.section, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'article_id' })
  article: ArticleEntity;

  @OneToMany(
    () => ArticleSectionImageEntity,
    (articleSectionImage) => articleSectionImage.section,
    {
      cascade: true,
      eager: true,
    },
  )
  sectionImage: ArticleSectionImageEntity[];

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];
}

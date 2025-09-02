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
import { MultilingualTextEntity } from './multilingual-text.entity';
import { NewsSectionImageEntity } from './news-section-image.entity';
import { NewsEntity } from './news.entity';
import { EntityEnum } from '../enum/entity.enum';

@Entity(EntityEnum.NEWS_SECTION)
@Index(['newsId', 'sortOrder'])
export class NewsSectionEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'news_id', nullable: false })
  newsId: number;

  @Column('int', { name: 'sort_order', default: 1, nullable: false })
  sortOrder: number;

  @ManyToOne(() => NewsEntity, (news) => news.section, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'news_id' })
  news: NewsEntity;

  @OneToMany(
    () => NewsSectionImageEntity,
    (newsSectionImage) => newsSectionImage.section,
    {
      cascade: true,
      eager: true,
    },
  )
  newsSectionImage: NewsSectionImageEntity[];

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];
}

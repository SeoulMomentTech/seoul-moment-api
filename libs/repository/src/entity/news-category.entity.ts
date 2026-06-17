import { Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { NewsEntity } from './news.entity';
import { EntityType } from '../enum/entity.enum';

/**
 * Multilgual column [name]
 */
@Entity(EntityType.NEWS_CATEGORY)
export class NewsCategoryEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @OneToMany(() => NewsEntity, (news) => news.newsCategory, {
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  news: NewsEntity[];
}

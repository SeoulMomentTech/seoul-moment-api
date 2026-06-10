import { Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { NewsEntity } from './news.entity';
import { EntityType } from '../enum/entity.enum';

/**
 * Multilgual column [name]
 */
@Entity(EntityType.NEWS_HASHTAG)
export class NewsHashtagEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @OneToMany(() => NewsEntity, (news) => news.hashtag, {})
  news: NewsEntity[];
}

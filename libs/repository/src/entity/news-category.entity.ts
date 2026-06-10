import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { NewsEntity } from './news.entity';

@Entity('news_category')
export class NewsCategoryEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', { length: 255, nullable: false })
  name: string;

  @OneToMany(() => NewsEntity, (news) => news.newsCategory, {
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  news: NewsEntity[];
}

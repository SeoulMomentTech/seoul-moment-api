import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CategoryEntity } from './category.entity';
import { CommonEntity } from './common.entity';
import { NewsSectionEntity } from './news-section.entity';
import { EntityEnum } from '../enum/entity.enum';
import { NewsStatus } from '../enum/news.enum';

@Entity(EntityEnum.NEWS)
export class NewsEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'category_id', nullable: false })
  categoryId: number;

  @Column('varchar', { length: 255, nullable: false })
  writer: string;

  @Column('enum', {
    enum: NewsStatus,
    default: NewsStatus.NORMAL,
    nullable: true,
  })
  status: NewsStatus;

  @ManyToOne(() => CategoryEntity, (category) => category.news, {
    eager: true,
  })
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity;

  @OneToMany(() => NewsSectionEntity, (section) => section.news, {
    eager: true,
  })
  section: NewsSectionEntity[];
}

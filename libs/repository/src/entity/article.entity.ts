import { Configuration } from '@app/config/configuration';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ArticleSectionEntity } from './article-section.entity';
import { CategoryEntity } from './category.entity';
import { CommonEntity } from './common.entity';
import { ArticleStatus } from '../enum/article.enum';
import { EntityType } from '../enum/entity.enum';

@Entity(EntityType.ARTICLE)
export class ArticleEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'category_id', nullable: false })
  categoryId: number;

  @Column('varchar', { length: 255, nullable: false })
  writer: string;

  @Column('text', { nullable: true })
  banner: string;

  @Column('text', { nullable: true })
  profileImage: string;

  @Column('enum', {
    enum: ArticleStatus,
    default: ArticleStatus.NORMAL,
    nullable: true,
  })
  status: ArticleStatus;

  @ManyToOne(() => CategoryEntity, (category) => category.news, {
    eager: true,
  })
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity;

  @OneToMany(() => ArticleSectionEntity, (section) => section.article, {
    eager: true,
  })
  section: ArticleSectionEntity[];

  getProfileImage(): string {
    return `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.profileImage}`;
  }
  getBannerImage(): string {
    return `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.banner}`;
  }
}

import { Configuration } from '@app/config/configuration';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BrandEntity } from './brand.entity';
import { CategoryEntity } from './category.entity';
import { CommonEntity } from './common.entity';
import { NewsSectionEntity } from './news-section.entity';
import { EntityType } from '../enum/entity.enum';
import { NewsStatus } from '../enum/news.enum';

/**
 * Multilgual column [title, content]
 */
@Entity(EntityType.NEWS)
export class NewsEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'category_id', nullable: false })
  categoryId: number;

  @Column('int', { name: 'brand_id', nullable: false })
  brandId: number;

  @Column('varchar', { length: 255, nullable: false })
  writer: string;

  @Column('text', { nullable: true })
  banner: string;

  @Column('text', { nullable: true })
  profileImage: string;

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

  @ManyToOne(() => BrandEntity, (brand) => brand.news, {
    eager: true,
  })
  @JoinColumn({ name: 'brand_id' })
  brand: BrandEntity;

  @OneToMany(() => NewsSectionEntity, (section) => section.news, {
    eager: true,
  })
  section: NewsSectionEntity[];

  getProfileImage(): string {
    return `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.profileImage}`;
  }
  getBannerImage(): string {
    return `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.banner}`;
  }
}

import { Configuration } from '@app/config/configuration';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ArticleEntity } from './article.entity';
import { BrandBannerImageEntity } from './brand-banner-image.entity';
import { BrandSectionEntity } from './brand-section.entity';
import { CategoryEntity } from './category.entity';
import { CommonEntity } from './common.entity';
import { MultilingualTextEntity } from './multilingual-text.entity';
import { NewsEntity } from './news.entity';
import { ProductEntity } from './product.entity';
import { BrandStatus } from '../enum/brand.enum';
import { EntityType } from '../enum/entity.enum';

/**
 * Multilgual column [name, description]
 */
@Entity(EntityType.BRAND)
export class BrandEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'category_id', nullable: false })
  categoryId: number;

  @Column('varchar', { length: 255, nullable: true })
  englishName: string;

  @Column('varchar', { length: 255, nullable: true })
  profileImage: string;

  @Column('varchar', { length: 255, nullable: true })
  bannerImageUrl: string;

  @Column('enum', {
    enum: BrandStatus,
    default: BrandStatus.NORMAL,
    nullable: false,
  })
  status: BrandStatus;

  @OneToMany(
    () => BrandBannerImageEntity,
    (brandBannerImage) => brandBannerImage.brand,
    {
      cascade: true,
      eager: true,
    },
  )
  bannerImage: BrandBannerImageEntity[];

  @OneToMany(() => BrandSectionEntity, (brandSection) => brandSection.brand, {
    cascade: true,
    eager: true,
  })
  section: BrandSectionEntity[];

  @OneToMany(() => NewsEntity, (news) => news.brand, {
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  news: NewsEntity[];

  @OneToMany(() => ArticleEntity, (article) => article.brand, {
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  article: ArticleEntity[];

  @OneToMany(() => ProductEntity, (product) => product.brand, {
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  products: ProductEntity[];

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];

  @ManyToOne(() => CategoryEntity, (category) => category.brand, {
    eager: true,
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity;

  getProfileImage(): string {
    return `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.profileImage}`;
  }
  getBannerImage(): string {
    return `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.bannerImageUrl}`;
  }
}

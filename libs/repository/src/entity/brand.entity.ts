import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { ArticleEntity } from './article.entity';
import { BrandBannerImageEntity } from './brand-banner-image.entity';
import { BrandSectionEntity } from './brand-section.entity';
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
}

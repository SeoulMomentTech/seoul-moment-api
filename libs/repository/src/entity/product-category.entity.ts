import { Configuration } from '@app/config/configuration';
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
import { MultilingualTextEntity } from './multilingual-text.entity';
import { ProductEntity } from './product.entity';
import { EntityType } from '../enum/entity.enum';

/**
 * - 다국어 지원: name
 */
@Entity(EntityType.PRODUCT_CATEGORY)
export class ProductCategoryEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'category_id', nullable: true })
  categoryId: number;

  @Column('varchar', { length: 255, nullable: true })
  imageUrl: string;

  @Column('int', { name: 'sort_order', default: 1, nullable: false })
  sortOrder: number;

  @OneToMany(() => ProductEntity, (product) => product.productCategory, {
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  products: ProductEntity[];

  @ManyToOne(() => CategoryEntity, (category) => category.productCategory)
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity;

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];

  getImage(): string {
    return `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.imageUrl}`;
  }
}

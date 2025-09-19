import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { BrandEntity } from './brand.entity';
import { CommonEntity } from './common.entity';
import { MultilingualTextEntity } from './multilingual-text.entity';
import { ProductCategoryEntity } from './product-category.entity';
import { ProductEntity } from './product.entity';
import { EntityType } from '../enum/entity.enum';

/**
 * - 다국어 지원: name
 */
@Entity(EntityType.CATEGORY)
export class CategoryEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'sort_order', default: 1, nullable: false })
  sortOrder: number;

  @OneToMany(() => ProductEntity, (product) => product.category, {
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  products: ProductEntity[];

  @OneToMany(() => BrandEntity, (brand) => brand.category, {
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  brand: BrandEntity[];

  @OneToMany(
    () => ProductCategoryEntity,
    (productCategory) => productCategory.category,
    {
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  productCategory: ProductCategoryEntity[];

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];
}

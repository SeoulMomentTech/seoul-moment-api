import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

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

  @Column('int', { name: 'sort_order', default: 1, nullable: false })
  sortOrder: number;

  @OneToMany(() => ProductEntity, (product) => product.productCategory, {
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  products: ProductEntity[];

  @OneToMany(() => MultilingualTextEntity, (text) => text.entityId, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  multilingualTexts: MultilingualTextEntity[];
}

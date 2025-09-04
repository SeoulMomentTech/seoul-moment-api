import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { OptionValueEntity } from './option-value.entity';
import { ProductEntity } from './product.entity';

@Entity('product_color')
@Index(['productId', 'optionValueId'], { unique: true })
export class ProductColorEntity extends CommonEntity {
  @PrimaryColumn('int', {
    name: 'product_id',
    comment: '상품 변형 ID',
  })
  productId: number;

  @PrimaryColumn('int', {
    name: 'option_value_id',
    comment: '옵션 값 ID',
  })
  optionValueId: number;

  // Relations
  @ManyToOne(() => ProductEntity, (product) => product.productColors, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @ManyToOne(
    () => OptionValueEntity,
    (optionValue) => optionValue.variantOptions,
    {
      onDelete: 'CASCADE',
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  @JoinColumn({ name: 'option_value_id' })
  optionValue: OptionValueEntity;
}

import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { OptionValueEntity } from './option-value.entity';
import { ProductVariantEntity } from './product-variant.entity';

/**
 * 상품 변형 - 옵션값 연결 Entity
 * - ProductVariant와 OptionValue의 N:M 관계 매핑
 * - 복합키 사용 (variant_id, option_value_id)
 * - 핵심 쿼리: 옵션 조합으로 ProductVariant 찾기
 */
@Entity('variant_option')
@Index(['variantId', 'optionValueId'], { unique: true })
export class VariantOptionEntity extends CommonEntity {
  @PrimaryColumn('int', {
    name: 'variant_id',
    comment: '상품 변형 ID',
  })
  variantId: number;

  @PrimaryColumn('int', {
    name: 'option_value_id',
    comment: '옵션 값 ID',
  })
  optionValueId: number;

  // Relations
  @ManyToOne(() => ProductVariantEntity, (variant) => variant.variantOptions, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariantEntity;

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

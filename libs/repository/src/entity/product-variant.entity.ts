import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { ProductItemEntity } from './product-item.entity';
import { VariantOptionEntity } from './variant-option.entity';
import { ProductVariantStatus } from '../enum/product.enum';

/**
 * 상품 변형 Entity (실제 판매 상품)
 * - 실제 구매/재고 관리되는 단위
 * - SKU, 가격, 재고 등 판매 관련 정보
 */
@Entity('product_variant')
@Index(['productItemId'])
@Index(['sku'], { unique: true })
@Index(['productItemId', 'status'])
export class ProductVariantEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  // TODO 개발 서버 적용 후 nullable: false 로 변경
  @Column('int', {
    name: 'product_item_id',
    nullable: true,
    comment: '상품 ID',
  })
  productItemId: number;

  @Column('varchar', {
    length: 100,
    nullable: false,
    unique: true,
    comment: 'SKU (재고 관리 단위)',
  })
  sku: string;

  @Column('int', {
    name: 'stock_quantity',
    default: 0,
    comment: '재고 수량',
  })
  stockQuantity: number;

  @Column('boolean', {
    name: 'is_active',
    default: true,
    comment: '활성화 여부',
  })
  isActive: boolean;

  @Column('enum', {
    enum: ProductVariantStatus,
    default: ProductVariantStatus.ACTIVE,
    nullable: false,
    comment: '상품 변형 상태',
  })
  status: ProductVariantStatus;

  // Relations
  @ManyToOne(() => ProductItemEntity, (productItem) => productItem.variants, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    eager: false,
  })
  @JoinColumn({ name: 'product_item_id' })
  productItem: ProductItemEntity;

  @OneToMany(
    () => VariantOptionEntity,
    (variantOption) => variantOption.variant,
    {
      cascade: true,
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  variantOptions: VariantOptionEntity[];

  isInStock(): boolean {
    return (
      this.stockQuantity > 0 &&
      this.isActive &&
      this.status === ProductVariantStatus.ACTIVE
    );
  }
}

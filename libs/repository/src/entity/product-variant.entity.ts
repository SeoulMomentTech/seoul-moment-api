import { Configuration } from '@app/config/configuration';
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
import { ProductEntity } from './product.entity';
import { VariantOptionEntity } from './variant-option.entity';
import { ProductVariantStatus } from '../enum/product.enum';

/**
 * 상품 변형 Entity (실제 판매 상품)
 * - 실제 구매/재고 관리되는 단위
 * - SKU, 가격, 재고 등 판매 관련 정보
 */
@Entity('product_variant')
@Index(['productId'])
@Index(['sku'], { unique: true })
@Index(['productId', 'status'])
export class ProductVariantEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', {
    name: 'product_id',
    nullable: false,
    comment: '상품 ID',
  })
  productId: number;

  @Column('varchar', {
    length: 100,
    nullable: false,
    unique: true,
    comment: 'SKU (재고 관리 단위)',
  })
  sku: string;

  @Column('decimal', {
    precision: 10,
    scale: 0,
    nullable: false,
    comment: '가격',
  })
  price: number;

  @Column('decimal', {
    name: 'discount_price',
    precision: 10,
    scale: 0,
    nullable: true,
    comment: '할인 가격',
  })
  discountPrice: number;

  @Column('int', {
    name: 'stock_quantity',
    default: 0,
    comment: '재고 수량',
  })
  stockQuantity: number;

  @Column('varchar', {
    name: 'main_image_url',
    length: 500,
    nullable: true,
    comment: '목록 페이지용 대표 이미지 URL',
  })
  mainImageUrl: string;

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
  @ManyToOne(() => ProductEntity, (product) => product.variants, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @OneToMany(
    () => VariantOptionEntity,
    (variantOption) => variantOption.variant,
    {
      cascade: true,
      createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
    },
  )
  variantOptions: VariantOptionEntity[];

  // Utility methods
  getMainImage(): string {
    return this.mainImageUrl
      ? `${Configuration.getConfig().IMAGE_DOMAIN_NAME}${this.mainImageUrl}`
      : '';
  }

  // Utility methods
  getEffectivePrice(): number {
    return this.discountPrice || this.price;
  }

  isInStock(): boolean {
    return (
      this.stockQuantity > 0 &&
      this.isActive &&
      this.status === ProductVariantStatus.ACTIVE
    );
  }
}

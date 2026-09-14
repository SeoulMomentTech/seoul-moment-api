import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { OrderEntity } from './order.entity';
import { ProductVariantEntity } from './product-variant.entity';

/**
 * 주문 라인.
 *
 * 다른 엔티티는 전부 CASCADE 지만 product_variant 만 SET NULL 이다.
 * 주문 내역이 상품 삭제로 사라지면 안 되기 때문이다. 그래서 화면에 필요한
 * 값은 전부 스냅샷으로 복사해 두고, 스냅샷만으로 주문 상세가 온전히
 * 렌더링되어야 한다.
 *
 * 배송비는 배송지로 정해지므로 라인에는 배송비 컬럼을 두지 않는다.
 */
@Entity('order_item')
@Index(['orderId'])
export class OrderItemEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', {
    name: 'order_id',
    nullable: false,
    comment: '주문 ID (order.id 참조)',
  })
  orderId: number;

  @Column('int', {
    name: 'product_variant_id',
    nullable: true,
    comment: '상품 변형 ID. 상품이 삭제되면 NULL 이 되고 스냅샷만 남는다',
  })
  productVariantId: number | null;

  @Column('int', {
    name: 'product_item_id',
    nullable: false,
    comment: '상품 아이템 ID (조회 편의용, FK 제약 없음)',
  })
  productItemId: number;

  @Column('int', {
    name: 'brand_id',
    nullable: false,
    comment: '브랜드 ID (표시용 그룹핑 키, FK 제약 없음)',
  })
  brandId: number;

  @Column('varchar', {
    name: 'brand_name_snapshot',
    length: 255,
    nullable: true,
    comment: '주문 시점 브랜드명 (multilingual_text 의존을 끊는다)',
  })
  brandNameSnapshot: string;

  @Column('varchar', {
    name: 'product_name_snapshot',
    length: 255,
    nullable: true,
    comment: '주문 시점 언어의 상품명',
  })
  productNameSnapshot: string;

  @Column('varchar', {
    name: 'option_text_snapshot',
    length: 255,
    nullable: true,
    comment: '옵션 조합 텍스트 (예: IVORY / M)',
  })
  optionTextSnapshot: string;

  @Column('varchar', {
    name: 'image_url_snapshot',
    length: 500,
    nullable: true,
    comment: '주문 시점 대표 이미지 URL',
  })
  imageUrlSnapshot: string;

  @Column('varchar', {
    name: 'sku_snapshot',
    length: 100,
    nullable: true,
    comment: '주문 시점 SKU',
  })
  skuSnapshot: string;

  @Column('int', {
    name: 'unit_price',
    nullable: false,
    default: 0,
    comment: '정가 (product_item.price)',
  })
  unitPrice: number;

  @Column('int', {
    name: 'unit_discount_price',
    nullable: false,
    default: 0,
    comment: '실제 적용가 (getEffectivePrice)',
  })
  unitDiscountPrice: number;

  @Column('int', {
    nullable: false,
    default: 1,
    comment: '수량',
  })
  quantity: number;

  @Column('int', {
    name: 'total_price',
    nullable: false,
    default: 0,
    comment: '라인 금액 (unit_discount_price * quantity)',
  })
  totalPrice: number;

  @ManyToOne(() => OrderEntity, (order) => order.items, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;

  @ManyToOne(() => ProductVariantEntity, {
    onDelete: 'SET NULL',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'product_variant_id' })
  productVariant: ProductVariantEntity;
}

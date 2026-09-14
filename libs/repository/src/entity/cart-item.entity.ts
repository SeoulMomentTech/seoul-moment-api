import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { ProductVariantEntity } from './product-variant.entity';
import { UserEntity } from './user.entity';

/**
 * 장바구니 라인.
 *
 * 재고 단위가 product_variant(SKU) 이므로 product_item 이 아니라 variant 를
 * 가리킨다. 가격은 variant 에 없으므로 부모 product_item 에서 조인해 온다.
 *
 * 가격 스냅샷을 두지 않는다 — 장바구니는 항상 현재가를 보여주고,
 * 스냅샷은 주문(order_item) 시점에만 뜬다.
 *
 * ⚠ 삭제는 반드시 hard delete(`repository.delete()`) 로 한다.
 * CommonEntity 의 soft delete 를 쓰면 삭제된 행이 (user_id, product_variant_id)
 * UNIQUE 제약에 그대로 남아 같은 상품을 다시 담을 수 없게 된다.
 */
@Entity('cart_item')
@Unique(['userId', 'productVariantId'])
@Index(['userId', 'createDate'])
export class CartItemEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', {
    name: 'user_id',
    nullable: false,
    comment: '사용자 ID (user.id 참조)',
  })
  userId: number;

  @Column('int', {
    name: 'product_variant_id',
    nullable: false,
    comment: '상품 변형 ID (product_variant.id 참조, 재고 단위)',
  })
  productVariantId: number;

  @Column('int', {
    nullable: false,
    default: 1,
    comment: '수량',
  })
  quantity: number;

  @ManyToOne(() => UserEntity, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => ProductVariantEntity, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'product_variant_id' })
  productVariant: ProductVariantEntity;
}

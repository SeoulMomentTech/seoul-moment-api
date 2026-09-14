import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { OrderItemEntity } from './order-item.entity';
import { OrderShippingEntity } from './order-shipping.entity';
import { UserEntity } from './user.entity';
import { OrderStatus, PaymentMethod } from '../enum/order.enum';

/**
 * 주문 헤더.
 *
 * 테이블명 `order` 는 Postgres 예약어지만 TypeORM 이 식별자를 quote 하므로
 * 문제없다. 다만 raw SQL(테스트 truncate 등)에서는 `"order"` 로 감싸야 한다.
 *
 * 배송비 관련 3개 컬럼은 shipping_policy 를 참조해 계산한 **결과 스냅샷**이다.
 * 요율·임계금액·프로모션은 admin 에서 언제든 바뀌므로, FK 를 걸면 과거 주문의
 * 금액 근거가 함께 흔들린다. 그래서 FK 없이 값만 박아둔다.
 */
@Entity('order')
@Index(['userId', 'createDate'])
@Index(['status'])
export class OrderEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', {
    name: 'order_number',
    length: 32,
    nullable: true,
    unique: true,
    comment:
      '주문번호 (SM-20260903-000481). INSERT 후 같은 트랜잭션에서 채운다',
  })
  orderNumber: string;

  @Column('int', {
    name: 'user_id',
    nullable: false,
    comment: '주문자 ID (user.id 참조)',
  })
  userId: number;

  @Column('enum', {
    enum: OrderStatus,
    default: OrderStatus.PENDING,
    nullable: false,
    comment: '주문 상태',
  })
  status: OrderStatus;

  @Column('int', {
    name: 'total_product_amount',
    nullable: false,
    default: 0,
    comment: '상품 금액 합',
  })
  totalProductAmount: number;

  @Column('int', {
    name: 'shipping_fee_applied',
    nullable: false,
    default: 0,
    comment: '실제 청구한 배송비 (무료배송이면 0)',
  })
  shippingFeeApplied: number;

  @Column('boolean', {
    name: 'is_remote_island',
    nullable: false,
    default: false,
    comment: '외섬 판정 결과. 배송비가 0이어도 분석을 위해 기록한다',
  })
  isRemoteIsland: boolean;

  @Column('int', {
    name: 'free_shipping_threshold_snapshot',
    nullable: false,
    default: 0,
    comment: '판정에 사용한 무료배송 임계금액',
  })
  freeShippingThresholdSnapshot: number;

  @Column('int', {
    name: 'total_amount',
    nullable: false,
    default: 0,
    comment: '최종 결제 금액 (상품 금액 합 + 배송비)',
  })
  totalAmount: number;

  @Column('enum', {
    name: 'payment_method',
    enum: PaymentMethod,
    nullable: true,
    comment: '사용자가 선택한 결제 수단',
  })
  paymentMethod: PaymentMethod;

  @ManyToOne(() => UserEntity, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @OneToMany(() => OrderItemEntity, (item) => item.order, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  items: OrderItemEntity[];

  @OneToOne(() => OrderShippingEntity, (shipping) => shipping.order, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  shipping: OrderShippingEntity;

  /** SM-{yyyyMMdd}-{id 6자리 0패딩}. id 기반이라 충돌이 구조적으로 불가능하다 */
  static buildOrderNumber(id: number, baseDate: Date): string {
    const yyyy = baseDate.getUTCFullYear();
    const mm = String(baseDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(baseDate.getUTCDate()).padStart(2, '0');

    return `SM-${yyyy}${mm}${dd}-${String(id).padStart(6, '0')}`;
  }
}

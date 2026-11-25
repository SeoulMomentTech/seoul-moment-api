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
import { OrderInvoiceEntity } from './order-invoice.entity';
import { OrderItemEntity } from './order-item.entity';
import { OrderShippingEntity } from './order-shipping.entity';
import { UserEntity } from './user.entity';
import {
  DeliveryStage,
  OrderStatus,
  PaymentMethod,
  PurchaseStatus,
} from '../enum/order.enum';

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
@Index(['status', 'paidAt'])
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
    name: 'international_discount',
    nullable: false,
    default: 0,
    comment:
      '국제배송비 지원 할인액 스냅샷. 판매할인으로 상품 금액에서 1회 차감된다',
  })
  internationalDiscount: number;

  @Column('int', {
    name: 'total_amount',
    nullable: false,
    default: 0,
    comment: '최종 결제 금액 (상품 금액 합 - 국제배송비 지원 할인 + 배송비)',
  })
  totalAmount: number;

  @Column('enum', {
    name: 'payment_method',
    enum: PaymentMethod,
    nullable: true,
    comment: '사용자가 선택한 결제 수단',
  })
  paymentMethod: PaymentMethod;

  @Column('boolean', {
    name: 'stock_reserved',
    nullable: false,
    default: false,
    comment:
      '이 주문이 재고를 잡고 있는지. 결제 시작 때 잡고 실패·만료 때 돌려준다. 두 번 차감·복구를 막는 표시',
  })
  stockReserved: boolean;

  @Column('timestamptz', {
    name: 'paid_at',
    nullable: true,
    comment: '결제 확정 시각',
  })
  paidAt: Date | null;

  @Column('enum', {
    name: 'delivery_stage',
    enum: DeliveryStage,
    default: DeliveryStage.ORDER_CONFIRMED,
    nullable: false,
    comment: '고객 배송 6단계. 결제·취소·환불 상태와 독립',
  })
  deliveryStage: DeliveryStage;

  @Column('enum', {
    name: 'purchase_status',
    enum: PurchaseStatus,
    default: PurchaseStatus.NOT_ORDERED,
    nullable: false,
    comment: '한국 공급처 발주 여부',
  })
  purchaseStatus: PurchaseStatus;

  @Column('timestamptz', {
    name: 'supplier_ordered_at',
    nullable: true,
    comment: '한국 공급처 발주 시각',
  })
  supplierOrderedAt: Date | null;

  @Column('varchar', {
    name: 'supplier_order_no',
    length: 100,
    nullable: true,
    comment: '공급처 발주번호 (관리자 입력)',
  })
  supplierOrderNo: string | null;

  @Column('varchar', {
    name: 'purchase_override_reason',
    length: 500,
    nullable: true,
    comment: '24시간 전에 조기 발주한 사유. 정상 발주면 null',
  })
  purchaseOverrideReason: string | null;

  @Column('int', {
    name: 'purchased_by_admin_id',
    nullable: true,
    comment: '발주 처리한 관리자 ID',
  })
  purchasedByAdminId: number | null;

  @Column('timestamptz', {
    name: 'cancellation_requested_at',
    nullable: true,
    comment: '취소·계약해제 통지 접수 시각. 있으면 발주를 막는다',
  })
  cancellationRequestedAt: Date | null;

  @Column('varchar', {
    name: 'cancellation_reason',
    length: 500,
    nullable: true,
    comment: '고객이 적은 취소·계약해제 사유',
  })
  cancellationReason: string | null;

  @Column('varchar', {
    name: 'local_carrier',
    length: 50,
    nullable: true,
    comment: '대만 국내운송사',
  })
  localCarrier: string | null;

  @Column('varchar', {
    name: 'local_tracking_no',
    length: 100,
    nullable: true,
    comment: '대만 국내운송장 번호',
  })
  localTrackingNo: string | null;

  @Column('timestamptz', {
    name: 'delivered_at',
    nullable: true,
    comment: '실제 수령·배송 완료 시각. 법정 기간 계산의 기준이다',
  })
  deliveredAt: Date | null;

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

  @OneToOne(() => OrderInvoiceEntity, (invoice) => invoice.order, {
    cascade: true,
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  invoice: OrderInvoiceEntity;

  /** SM-{yyyyMMdd}-{id 6자리 0패딩}. id 기반이라 충돌이 구조적으로 불가능하다 */
  static buildOrderNumber(id: number, baseDate: Date): string {
    const yyyy = baseDate.getUTCFullYear();
    const mm = String(baseDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(baseDate.getUTCDate()).padStart(2, '0');

    return `SM-${yyyy}${mm}${dd}-${String(id).padStart(6, '0')}`;
  }
}

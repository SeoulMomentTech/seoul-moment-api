import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { PaymentMethod } from '../enum/order.enum';
import { RefundStatus } from '../enum/refund.enum';

/**
 * 환불. 주문의 금액 스냅샷은 건드리지 않고 여기에 따로 기록한다.
 *
 * shortcut: 전액 환불만 하므로 주문당 1행(order_id UNIQUE)이고, 이 UNIQUE 가 버튼 중복
 * 클릭의 이중 환불을 막는다. 부분 환불을 넣을 때 UNIQUE 를 풀고 누계 검증으로 바꾼다.
 */
@Entity('refund')
@Index(['status'])
export class RefundEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', {
    name: 'order_id',
    nullable: false,
    unique: true,
    comment: '주문 ID',
  })
  orderId: number;

  @Column('int', {
    name: 'payment_id',
    nullable: false,
    comment: '환불 대상 결제 시도 ID',
  })
  paymentId: number;

  @Column('enum', {
    enum: PaymentMethod,
    nullable: false,
    comment: '원 결제 수단',
  })
  method: PaymentMethod;

  @Column('int', { nullable: false, comment: '환불 금액 (TWD)' })
  amount: number;

  @Column('enum', {
    enum: RefundStatus,
    default: RefundStatus.REQUESTED,
    nullable: false,
    comment: '환불 상태',
  })
  status: RefundStatus;

  @Column('boolean', {
    name: 'is_manual',
    nullable: false,
    default: false,
    comment:
      'PG 환불 API 를 쓰지 않고 관리자가 직접 처리하는 환불 (ECPay 카드·ATM·편의점)',
  })
  isManual: boolean;

  @Column('varchar', {
    length: 500,
    nullable: true,
    comment: '환불 근거 (관리자 입력)',
  })
  reason: string | null;

  @Column('int', {
    name: 'admin_id',
    nullable: false,
    comment: '환불을 시작한 관리자 ID',
  })
  adminId: number;

  @Column('varchar', {
    name: 'pg_refund_id',
    length: 100,
    nullable: true,
    comment: 'LINE Pay refundTransactionId, 수동 환불이면 처리 참조번호',
  })
  pgRefundId: string | null;

  @Column('int', {
    name: 'attempt_count',
    nullable: false,
    default: 0,
    comment: 'PG 환불 요청 횟수',
  })
  attemptCount: number;

  @Column('varchar', {
    name: 'failure_code',
    length: 50,
    nullable: true,
    comment: 'PG 응답 코드',
  })
  failureCode: string | null;

  @Column('varchar', {
    name: 'failure_message',
    length: 255,
    nullable: true,
    comment: 'PG 응답 메시지',
  })
  failureMessage: string | null;

  @Column('timestamptz', {
    name: 'requested_at',
    nullable: false,
    comment: '환불 요청 시각',
  })
  requestedAt: Date;

  @Column('timestamptz', {
    name: 'completed_at',
    nullable: true,
    comment: '환불 성공을 확인한 시각',
  })
  completedAt: Date | null;
}

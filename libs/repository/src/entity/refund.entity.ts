import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { PaymentMethod } from '../enum/order.enum';
import { RefundStatus } from '../enum/refund.enum';

/**
 * 환불. 주문의 금액 스냅샷은 건드리지 않고 여기에 따로 기록한다.
 *
 * 부분 환불이 있어 한 주문에 여러 행이 생긴다. 다만 끝나지 않은 환불은 주문당 하나뿐이다
 * (아래 부분 UNIQUE) — 버튼 중복 클릭이 환불을 두 건 만들지 못하고, 앞 환불의 결과를
 * 모르는 채로 다음 환불을 시작하지 못한다. 환불 합계는 결제 금액을 넘지 않게 서비스가 막는다.
 */
@Entity('refund')
@Index(['status'])
@Index(['orderId'])
@Index('uq_refund_open_order', ['orderId'], {
  unique: true,
  where: `"status" <> 'COMPLETED'`,
})
export class RefundEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', {
    name: 'order_id',
    nullable: false,
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

  @Column('int', {
    nullable: false,
    comment: '환불 금액 (TWD). 결제 금액보다 작으면 부분 환불',
  })
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
    comment: '환불 근거 (관리자 입력, 자동 환불이면 고객의 취소 사유)',
  })
  reason: string | null;

  @Column('int', {
    name: 'admin_id',
    nullable: true,
    comment:
      '환불을 시작한 관리자 ID. NULL 이면 고객 취소로 시스템이 시작한 자동 환불',
  })
  adminId: number | null;

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

  @Column('int', {
    name: 'pg_refunded_before',
    nullable: true,
    comment:
      '이 환불을 처음 보내기 직전에 LINE Pay 거래에 이미 있던 환불 합계. 결과 조회에서 이만큼을 빼고 본다 (NULL 은 0)',
  })
  pgRefundedBefore: number | null;

  @Column('timestamptz', {
    name: 'last_attempt_at',
    nullable: true,
    comment: 'PG 에 마지막으로 환불을 요청한 시각',
  })
  lastAttemptAt: Date | null;

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

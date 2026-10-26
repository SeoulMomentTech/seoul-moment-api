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
import { PaymentMethod } from '../enum/order.enum';
import { ACTIVE_PAYMENT_STATUSES, PaymentStatus } from '../enum/payment.enum';

/**
 * 결제 시도. 주문 1 : 결제 시도 N.
 *
 * ECPay MerchantTradeNo 는 실패한 시도라도 다시 쓸 수 없고, LINE Pay orderId 도
 * 중복이면 거절된다. 결제창에서 이탈한 뒤 같은 주문으로 다시 결제하려면 매번 새
 * 거래번호가 필요해서 주문과 떼어 둔다.
 *
 * 시각 컬럼은 timestamptz 로 둔다. CommonEntity 의 create_date 는 timezone 이
 * 없는 UTC 벽시계라 컨테이너 TZ 에 따라 읽히는 값이 달라진다 — 만료 판정에 쓰면 안 된다.
 */
@Entity('payment')
@Index(['orderId'])
@Index(['status', 'method'])
export class PaymentEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', {
    name: 'order_id',
    nullable: false,
    comment: '주문 ID (order.id 참조)',
  })
  orderId: number;

  @Column('enum', {
    enum: PaymentMethod,
    nullable: false,
    comment: '결제 수단',
  })
  method: PaymentMethod;

  @Column('enum', {
    enum: PaymentStatus,
    default: PaymentStatus.READY,
    nullable: false,
    comment: '결제 시도 상태',
  })
  status: PaymentStatus;

  @Column('varchar', {
    name: 'merchant_trade_no',
    length: 20,
    nullable: true,
    unique: true,
    comment:
      '우리 쪽 거래번호. ECPay MerchantTradeNo · LINE Pay orderId 로 같이 쓴다 (영숫자 20자 이하). INSERT 후 같은 트랜잭션에서 채운다',
  })
  merchantTradeNo: string;

  @Column('int', {
    nullable: false,
    comment: '요청 금액 (TWD). 콜백 금액과 대조한다',
  })
  amount: number;

  @Column('varchar', {
    name: 'access_token',
    length: 64,
    nullable: false,
    unique: true,
    comment:
      '로그인 없이 결제창을 열고(handoff) 결과를 볼 때 쓰는 토큰. LINE 안에서 외부 브라우저로 넘기는 경우 때문이다',
  })
  accessToken: string;

  @Column('varchar', {
    length: 5,
    nullable: true,
    comment: '결제 시작 시 Accept-Language (ECPay 결제창 언어)',
  })
  locale: string | null;

  @Column('varchar', {
    name: 'pg_transaction_id',
    length: 64,
    nullable: true,
    comment:
      'ECPay TradeNo / LINE Pay transactionId. LINE Pay 는 19자리라 숫자 컬럼에 넣으면 깨진다',
  })
  pgTransactionId: string | null;

  @Column('varchar', {
    name: 'pg_payment_type',
    length: 50,
    nullable: true,
    comment: 'ECPay PaymentType (Credit_CreditCard, ATM_LAND, CVS_CVS 등)',
  })
  pgPaymentType: string | null;

  @Column('jsonb', {
    name: 'deposit_info',
    nullable: true,
    comment: 'ATM 가상계좌 / 편의점 코드 · 바코드',
  })
  depositInfo: PaymentDepositInfo | null;

  @Column('timestamptz', {
    name: 'requested_at',
    nullable: true,
    comment: 'PG 로 넘긴 시각. 결제창 이탈 판정 기준',
  })
  requestedAt: Date | null;

  @Column('timestamptz', {
    name: 'handoff_opened_at',
    nullable: true,
    comment:
      'ECPay 결제창(handoff)을 연 시각. 같은 거래번호를 두 번 보내면 ECPay 가 거절하므로 한 번만 연다',
  })
  handoffOpenedAt: Date | null;

  @Column('timestamptz', {
    name: 'expire_at',
    nullable: true,
    comment: 'ATM·편의점 입금 기한',
  })
  expireAt: Date | null;

  @Column('timestamptz', { name: 'paid_at', nullable: true })
  paidAt: Date | null;

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

  @ManyToOne(() => OrderEntity, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;

  isTerminal(): boolean {
    return !ACTIVE_PAYMENT_STATUSES.includes(this.status);
  }
}

/** ATM 은 bankCode·account, 편의점 코드는 paymentNo, 바코드는 barcodes 를 채운다 */
export interface PaymentDepositInfo {
  paymentType: string;
  bankCode?: string;
  account?: string;
  paymentNo?: string;
  barcodes?: string[];
}

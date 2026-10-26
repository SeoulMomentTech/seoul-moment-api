import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { PaymentEventSource } from '../enum/payment.enum';

/**
 * 결제 콜백 · PG API 응답 원문을 쌓는 append-only 로그.
 * 재전송 · 중복 수신 · 금액 불일치를 나중에 추적하려고 둔다. 비밀값은 넣지 않는다.
 */
@Entity('payment_event')
@Index(['paymentId'])
export class PaymentEventEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', {
    name: 'payment_id',
    nullable: true,
    comment: '결제 시도 ID. 거래번호로 결제를 못 찾은 콜백은 NULL',
  })
  paymentId: number | null;

  @Column('enum', {
    enum: PaymentEventSource,
    nullable: false,
    comment: '어디서 온 기록인지',
  })
  source: PaymentEventSource;

  @Column('jsonb', { nullable: false, comment: '원문' })
  payload: Record<string, unknown>;

  @Column('varchar', {
    length: 255,
    nullable: true,
    comment: '처리 결과 메모 (검증 실패 사유 등)',
  })
  note: string | null;
}

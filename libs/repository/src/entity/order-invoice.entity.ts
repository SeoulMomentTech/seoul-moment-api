import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { OrderEntity } from './order.entity';
import { InvoiceStatus, InvoiceType } from '../enum/invoice.enum';

/**
 * 주문 전자발표 (1:1). order_shipping 처럼 PK 가 곧 FK 다.
 *
 * 주문서에서 받은 구매자 선택을 그대로 박아 두고, 결제가 확정되면 ECPay B2C 발표를
 * 발행해 결과(발표번호·랜덤번호)를 채운다. 대만 영업세법상 선결제 판매는 대금을
 * 받은 시점에 발행해야 해서 결제 확정 직후에 발행한다.
 *
 * relate_number 는 ECPay 쪽 멱등 키다. 작废 후에도 다시 쓸 수 없으므로 한 주문에
 * 하나만 만들고, 결과를 모르는 재시도는 같은 번호로 조회부터 한다.
 */
@Entity('order_invoice')
@Index(['status'])
export class OrderInvoiceEntity extends CommonEntity {
  @PrimaryColumn({
    name: 'order_id',
    type: 'int',
    comment: '주문 ID (PK, order.id 참조)',
  })
  orderId: number;

  @Column('enum', {
    enum: InvoiceType,
    nullable: false,
    comment: '발표 받는 방법',
  })
  type: InvoiceType;

  @Column('varchar', {
    name: 'carrier_num',
    length: 64,
    nullable: true,
    comment: '휴대폰 바코드 / 自然人憑證 번호',
  })
  carrierNum: string | null;

  @Column('varchar', {
    name: 'love_code',
    length: 7,
    nullable: true,
    comment: '기부 愛心碼',
  })
  loveCode: string | null;

  @Column('varchar', {
    name: 'company_tax_id',
    length: 8,
    nullable: true,
    comment: '統一編號',
  })
  companyTaxId: string | null;

  @Column('varchar', {
    name: 'company_name',
    length: 60,
    nullable: true,
    comment: '회사명 (統編 발표)',
  })
  companyName: string | null;

  @Column('varchar', {
    name: 'customer_email',
    length: 80,
    nullable: true,
    comment: '발표 통지 이메일 (이메일·전화번호 중 하나는 필수)',
  })
  customerEmail: string | null;

  @Column('varchar', {
    name: 'customer_phone',
    length: 20,
    nullable: true,
    comment: '발표 통지 전화번호 (숫자만)',
  })
  customerPhone: string | null;

  @Column('enum', {
    enum: InvoiceStatus,
    default: InvoiceStatus.PENDING,
    nullable: false,
    comment: '발행 상태',
  })
  status: InvoiceStatus;

  @Column('varchar', {
    name: 'relate_number',
    length: 50,
    nullable: true,
    unique: true,
    comment: 'ECPay RelateNumber (발행 요청 멱등 키, 재사용 불가)',
  })
  relateNumber: string | null;

  @Column('varchar', {
    name: 'invoice_no',
    length: 10,
    nullable: true,
    comment: '발표번호 (영문 2 + 숫자 8)',
  })
  invoiceNo: string | null;

  @Column('timestamptz', {
    name: 'invoice_date',
    nullable: true,
    comment: '발행 시각',
  })
  invoiceDate: Date | null;

  @Column('varchar', {
    name: 'random_number',
    length: 4,
    nullable: true,
    comment: '랜덤 번호 4자리',
  })
  randomNumber: string | null;

  @Column('int', {
    name: 'attempt_count',
    nullable: false,
    default: 0,
    comment: '발행 시도 횟수',
  })
  attemptCount: number;

  @Column('timestamptz', {
    name: 'last_attempt_at',
    nullable: true,
    comment: '마지막 발행 시도 시각 (재시도 간격 계산)',
  })
  lastAttemptAt: Date | null;

  @Column('varchar', {
    name: 'failure_code',
    length: 50,
    nullable: true,
  })
  failureCode: string | null;

  @Column('varchar', {
    name: 'failure_message',
    length: 255,
    nullable: true,
  })
  failureMessage: string | null;

  @OneToOne(() => OrderEntity, (order) => order.invoice, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;
}

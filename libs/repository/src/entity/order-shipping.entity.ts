import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { OrderEntity } from './order.entity';

/**
 * 주문 배송지 스냅샷 (1:1).
 *
 * user_profile 패턴을 따라 PK 가 곧 FK 다. 주소록 테이블은 두지 않고,
 * 기본 배송지는 user_profile + user.phone 을 읽어 여기에 복사한다.
 * 프로필 주소가 나중에 바뀌어도 주문 배송지는 그대로 남아야 한다.
 */
@Entity('order_shipping')
export class OrderShippingEntity extends CommonEntity {
  @PrimaryColumn({
    name: 'order_id',
    type: 'int',
    comment: '주문 ID (PK, order.id 참조)',
  })
  orderId: number;

  @Column('varchar', {
    name: 'recipient_name',
    length: 255,
    nullable: false,
    comment: '받는 분',
  })
  recipientName: string;

  @Column('varchar', {
    length: 255,
    nullable: false,
    comment: '연락처',
  })
  phone: string;

  @Column('varchar', {
    name: 'postal_code',
    length: 255,
    nullable: false,
    comment: '우편번호',
  })
  postalCode: string;

  @Column('varchar', {
    length: 255,
    nullable: false,
    comment: '縣市',
  })
  city: string;

  @Column('varchar', {
    length: 255,
    nullable: false,
    comment: '區/鄉',
  })
  district: string;

  @Column('varchar', {
    name: 'detail_address',
    length: 255,
    nullable: false,
    comment: '상세 주소',
  })
  detailAddress: string;

  @Column('varchar', {
    name: 'request_message',
    length: 255,
    nullable: true,
    comment: '배송 요청사항',
  })
  requestMessage: string;

  @OneToOne(() => OrderEntity, (order) => order.shipping, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;
}

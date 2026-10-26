import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { OrderEntity } from './order.entity';
import { ShippingType } from '../enum/order.enum';

/**
 * 주문 배송지 스냅샷 (1:1).
 *
 * user_profile 패턴을 따라 PK 가 곧 FK 다. 주소록 테이블은 두지 않고,
 * 기본 배송지는 user_profile + user.phone 을 읽어 여기에 복사한다.
 * 프로필 주소가 나중에 바뀌어도 주문 배송지는 그대로 남아야 한다.
 *
 * 편의점 픽업(CVS)이면 주소 컬럼은 비고 cvs_* 에 ECPay 전자지도에서 고른 매장을 박는다.
 * 편의점은 수령 시 이름을 신분증과 대조하므로 받는 분은 실명이어야 한다.
 */
@Entity('order_shipping')
export class OrderShippingEntity extends CommonEntity {
  @PrimaryColumn({
    name: 'order_id',
    type: 'int',
    comment: '주문 ID (PK, order.id 참조)',
  })
  orderId: number;

  @Column('enum', {
    name: 'shipping_type',
    enum: ShippingType,
    default: ShippingType.HOME,
    nullable: false,
    comment: '배송 방법 (택배 / 편의점 픽업)',
  })
  shippingType: ShippingType;

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
    nullable: true,
    comment: '우편번호',
  })
  postalCode: string;

  @Column('varchar', {
    length: 255,
    nullable: true,
    comment: '縣市 (편의점 픽업이면 NULL)',
  })
  city: string;

  @Column('varchar', {
    length: 255,
    nullable: true,
    comment: '區/鄉 (편의점 픽업이면 NULL)',
  })
  district: string;

  @Column('varchar', {
    name: 'detail_address',
    length: 255,
    nullable: true,
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

  @Column('varchar', {
    name: 'cvs_logistics_sub_type',
    length: 20,
    nullable: true,
    comment: 'ECPay LogisticsSubType (UNIMARTC2C, FAMIC2C …)',
  })
  cvsLogisticsSubType: string | null;

  @Column('varchar', {
    name: 'cvs_store_id',
    length: 10,
    nullable: true,
    comment: '편의점 매장 ID (CVSStoreID)',
  })
  cvsStoreId: string | null;

  @Column('varchar', {
    name: 'cvs_store_name',
    length: 50,
    nullable: true,
    comment: '편의점 매장명',
  })
  cvsStoreName: string | null;

  @Column('varchar', {
    name: 'cvs_store_address',
    length: 120,
    nullable: true,
    comment: '편의점 매장 주소',
  })
  cvsStoreAddress: string | null;

  @Column('varchar', {
    name: 'cvs_store_telephone',
    length: 20,
    nullable: true,
    comment: '편의점 매장 전화 (7-ELEVEN 은 주지 않는다)',
  })
  cvsStoreTelephone: string | null;

  @Column('boolean', {
    name: 'cvs_outside',
    nullable: true,
    comment: '離島 매장 여부 (CVSOutSide). 외섬 배송비 판정에 쓴다',
  })
  cvsOutside: boolean | null;

  @OneToOne(() => OrderEntity, (order) => order.shipping, {
    onDelete: 'CASCADE',
    createForeignKeyConstraints: process.env.NODE_ENV !== 'test',
  })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;
}

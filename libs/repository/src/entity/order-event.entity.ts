import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { CommonEntity } from './common.entity';
import { OrderEventType } from '../enum/order.enum';

/**
 * 주문 작업 이력 (append-only). 상태를 고칠 때 원 기록을 지우지 않고 한 줄을 더한다.
 * admin_id·user_id 가 둘 다 없으면 시스템이 남긴 기록이다.
 */
@Entity('order_event')
@Index(['orderId'])
export class OrderEventEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'order_id', nullable: false, comment: '주문 ID' })
  orderId: number;

  @Column('varchar', { length: 40, nullable: false, comment: '이력 종류' })
  type: OrderEventType;

  @Column('int', {
    name: 'admin_id',
    nullable: true,
    comment: '처리한 관리자 ID',
  })
  adminId: number | null;

  @Column('int', {
    name: 'user_id',
    nullable: true,
    comment: '요청한 고객 ID',
  })
  userId: number | null;

  @Column('varchar', {
    length: 500,
    nullable: true,
    comment: '무엇이 어떻게 바뀌었는지',
  })
  message: string | null;
}

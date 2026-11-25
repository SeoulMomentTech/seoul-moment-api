import { Entity, Index, PrimaryColumn } from 'typeorm';

import { CommonEntity } from './common.entity';

/** 국제배송 묶음 ↔ 주문 (다대다) */
@Entity('shipment_order')
@Index(['orderId'])
export class ShipmentOrderEntity extends CommonEntity {
  @PrimaryColumn({ name: 'shipment_id', type: 'int' })
  shipmentId: number;

  @PrimaryColumn({ name: 'order_id', type: 'int' })
  orderId: number;
}

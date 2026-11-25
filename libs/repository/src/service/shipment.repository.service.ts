import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';

import { ShipmentOrderEntity } from '../entity/shipment-order.entity';
import { ShipmentEntity } from '../entity/shipment.entity';
import { CustomsStatus } from '../enum/order.enum';

export interface ShipmentListQuery {
  keyword?: string;
  customsStatus?: CustomsStatus;
  skip: number;
  take: number;
}

@Injectable()
export class ShipmentRepositoryService {
  constructor(
    @InjectRepository(ShipmentEntity)
    private readonly shipmentRepository: Repository<ShipmentEntity>,
    @InjectRepository(ShipmentOrderEntity)
    private readonly shipmentOrderRepository: Repository<ShipmentOrderEntity>,
  ) {}

  async save(entity: ShipmentEntity): Promise<ShipmentEntity> {
    return this.shipmentRepository.save(entity);
  }

  async findById(id: number): Promise<ShipmentEntity | null> {
    return this.shipmentRepository.findOneBy({ id });
  }

  /** 묶음에 실린 주문을 통째로 바꾼다. 트랜잭션 안에서 부른다 */
  async replaceOrders(shipmentId: number, orderIds: number[]) {
    await this.shipmentOrderRepository.delete({ shipmentId });
    await this.shipmentOrderRepository.insert(
      orderIds.map((orderId) => ({ shipmentId, orderId })),
    );
  }

  async findLinks(shipmentIds: number[]): Promise<ShipmentOrderEntity[]> {
    if (shipmentIds.length === 0) {
      return [];
    }

    return this.shipmentOrderRepository.find({
      where: { shipmentId: In(shipmentIds) },
      order: { orderId: 'ASC' },
    });
  }

  async findByOrderId(orderId: number): Promise<ShipmentEntity[]> {
    return this.shipmentRepository
      .createQueryBuilder('s')
      .innerJoin(ShipmentOrderEntity, 'so', 'so.shipment_id = s.id')
      .where('so.order_id = :orderId', { orderId })
      .orderBy('s.id', 'ASC')
      .getMany();
  }

  /** 같은 번호를 쓰는 다른 묶음 ID. 막지는 않고 경고로만 쓴다 */
  async findIdsByNumber(
    field: 'intlTrackingNo' | 'importDeclarationNo',
    value: string,
    excludeId: number,
  ): Promise<number[]> {
    const rows = await this.shipmentRepository.find({
      select: { id: true },
      where: { [field]: value, id: Not(excludeId) },
      order: { id: 'ASC' },
    });

    return rows.map((row) => row.id);
  }

  /** 운송장·신고번호·주문번호·대만 운송장으로 찾는다 */
  async findPage(
    query: ShipmentListQuery,
  ): Promise<[ShipmentEntity[], number]> {
    const qb = this.shipmentRepository.createQueryBuilder('s');

    if (query.keyword) {
      qb.andWhere(
        `(s.intl_tracking_no ILIKE :kw OR s.house_airwaybill_no ILIKE :kw
          OR s.import_declaration_no ILIKE :kw OR EXISTS (
            SELECT 1 FROM shipment_order so
            JOIN "order" o ON o.id = so.order_id
            WHERE so.shipment_id = s.id
              AND (o.order_number ILIKE :kw OR o.local_tracking_no ILIKE :kw)))`,
        { kw: `%${query.keyword.replace(/[%_\\]/g, '\\$&')}%` },
      );
    }

    if (query.customsStatus) {
      qb.andWhere('s.customs_status = :customsStatus', {
        customsStatus: query.customsStatus,
      });
    }

    return qb
      .orderBy('s.id', 'DESC')
      .skip(query.skip)
      .take(query.take)
      .getManyAndCount();
  }
}

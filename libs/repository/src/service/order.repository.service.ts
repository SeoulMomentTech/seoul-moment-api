import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { OrderItemEntity } from '../entity/order-item.entity';
import { OrderShippingEntity } from '../entity/order-shipping.entity';
import { OrderEntity } from '../entity/order.entity';

@Injectable()
export class OrderRepositoryService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepository: Repository<OrderItemEntity>,
    @InjectRepository(OrderShippingEntity)
    private readonly orderShippingRepository: Repository<OrderShippingEntity>,
  ) {}

  async saveOrder(entity: OrderEntity): Promise<OrderEntity> {
    return this.orderRepository.save(entity);
  }

  /** 주문번호는 id 로 만들므로 INSERT 이후에야 확정된다 (같은 트랜잭션 안) */
  async updateOrderNumber(id: number, orderNumber: string) {
    return this.orderRepository.update({ id }, { orderNumber });
  }

  async saveItems(entities: OrderItemEntity[]): Promise<OrderItemEntity[]> {
    return this.orderItemRepository.save(entities);
  }

  async saveShipping(
    entity: OrderShippingEntity,
  ): Promise<OrderShippingEntity> {
    return this.orderShippingRepository.save(entity);
  }

  async findDetailByIdAndUserId(
    id: number,
    userId: number,
  ): Promise<OrderEntity | null> {
    return this.orderRepository.findOne({
      where: { id, userId },
      relations: { items: true, shipping: true },
      order: { items: { id: 'ASC' } },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';

import { OrderInvoiceEntity } from '../entity/order-invoice.entity';
import { OrderItemEntity } from '../entity/order-item.entity';
import { OrderShippingEntity } from '../entity/order-shipping.entity';
import { OrderEntity } from '../entity/order.entity';
import { PaymentEntity } from '../entity/payment.entity';
import { InvoiceStatus } from '../enum/invoice.enum';
import { OrderStatus } from '../enum/order.enum';
import { ACTIVE_PAYMENT_STATUSES } from '../enum/payment.enum';

/** 배치가 한 번에 집는 건수 */
const BATCH_LIMIT = 100;

@Injectable()
export class OrderRepositoryService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepository: Repository<OrderItemEntity>,
    @InjectRepository(OrderShippingEntity)
    private readonly orderShippingRepository: Repository<OrderShippingEntity>,
    @InjectRepository(OrderInvoiceEntity)
    private readonly orderInvoiceRepository: Repository<OrderInvoiceEntity>,
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
      relations: { items: true, shipping: true, invoice: true },
      order: { items: { id: 'ASC' } },
    });
  }

  async saveInvoice(entity: OrderInvoiceEntity): Promise<OrderInvoiceEntity> {
    return this.orderInvoiceRepository.save(entity);
  }

  /**
   * 발표 행을 고치되 이미 ISSUED 면 건드리지 않는다. 락 TTL 이 지난 늦은 작업이
   * 발행 완료를 FAILED 로 덮는 것을 막는다. 고쳤으면 true.
   */
  async updateInvoiceUnlessIssued(
    orderId: number,
    fields: Partial<
      Pick<
        OrderInvoiceEntity,
        | 'status'
        | 'relateNumber'
        | 'attemptCount'
        | 'lastAttemptAt'
        | 'failureCode'
        | 'failureMessage'
      >
    >,
  ): Promise<boolean> {
    const result = await this.orderInvoiceRepository.update(
      { orderId, status: Not(InvoiceStatus.ISSUED) },
      fields,
    );

    return (result.affected ?? 0) === 1;
  }

  async findInvoiceByOrderId(
    orderId: number,
  ): Promise<OrderInvoiceEntity | null> {
    return this.orderInvoiceRepository.findOneBy({ orderId });
  }

  /**
   * 결제가 확정됐는데 아직 발표가 안 나간 주문 (배치 재시도).
   * 재시도 간격(5분 × 2^(n-1), 최대 6시간)이 지난 것만 DB 에서 고른다 — LIMIT 뒤에
   * 메모리에서 거르면 차례가 안 된 앞쪽 건에 막혀 뒤쪽이 굶는다.
   */
  async findInvoicesToIssue(
    maxAttempts: number,
    now: Date,
  ): Promise<OrderInvoiceEntity[]> {
    return this.orderInvoiceRepository
      .createQueryBuilder('i')
      .innerJoin(OrderEntity, 'o', 'o.id = i.order_id')
      .where('i.status IN (:...statuses)', {
        statuses: [InvoiceStatus.PENDING, InvoiceStatus.FAILED],
      })
      .andWhere('i.attempt_count < :maxAttempts', { maxAttempts })
      .andWhere('o.status = :paid', { paid: OrderStatus.PAID })
      .andWhere(
        `(i.last_attempt_at IS NULL OR i.last_attempt_at + LEAST(
           make_interval(mins => (5 * power(2, GREATEST(i.attempt_count - 1, 0)))::int),
           interval '6 hours') <= :now)`,
        { now },
      )
      .orderBy('i.order_id', 'ASC')
      .limit(BATCH_LIMIT)
      .getMany();
  }

  /**
   * 결제는 됐는데 order_invoice 행이 없는 주문 (이 기능 전에 만든 주문). 커밋 직후 발행이
   * 건너뛰어지면(락 실패·프로세스 종료) 행이 영영 안 생기므로 배치가 찾아 준다.
   */
  async findPaidOrderIdsWithoutInvoice(paidSince: Date): Promise<number[]> {
    const rows: { id: number }[] = await this.orderRepository
      .createQueryBuilder('o')
      .select('o.id', 'id')
      .leftJoin(OrderInvoiceEntity, 'i', 'i.order_id = o.id')
      .where('o.status = :paid', { paid: OrderStatus.PAID })
      .andWhere('o.paid_at >= :paidSince', { paidSince })
      .andWhere('i.order_id IS NULL')
      .orderBy('o.id', 'ASC')
      .limit(BATCH_LIMIT)
      .getRawMany();

    return rows.map((row) => Number(row.id));
  }

  async findById(id: number): Promise<OrderEntity | null> {
    return this.orderRepository.findOneBy({ id });
  }

  /**
   * 트랜잭션 안에서만 부른다. 결제 시작·콜백·배치가 같은 주문을 동시에 만지지 않게
   * 주문 행을 잠근다. FOR UPDATE 는 outer join 의 nullable 쪽에 걸 수 없어서
   * 라인은 findItemsByOrderId 로 따로 읽는다.
   */
  async findByIdForUpdate(id: number): Promise<OrderEntity | null> {
    return this.orderRepository.findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
  }

  async findItemsByOrderId(orderId: number): Promise<OrderItemEntity[]> {
    return this.orderItemRepository.find({
      where: { orderId },
      order: { id: 'ASC' },
    });
  }

  async updateOrder(
    id: number,
    fields: Partial<Pick<OrderEntity, 'status' | 'stockReserved' | 'paidAt'>>,
  ) {
    return this.orderRepository.update({ id }, fields);
  }

  /**
   * 결제 없이 오래 남은 PENDING 주문. create_date 는 timezone 없는 UTC 벽시계라
   * JS Date 와 비교하지 않고 DB 시각으로 비교한다.
   */
  async findStalePendingIds(olderThanHours: number): Promise<number[]> {
    const rows: { id: number }[] = await this.orderRepository
      .createQueryBuilder('o')
      .select('o.id', 'id')
      .where('o.status = :status', { status: OrderStatus.PENDING })
      .andWhere(
        `o.create_date < (NOW() AT TIME ZONE 'UTC') - make_interval(hours => :hours)`,
        { hours: olderThanHours },
      )
      .andWhere(
        (qb) =>
          `NOT EXISTS ${qb
            .subQuery()
            .select('1')
            .from(PaymentEntity, 'p')
            .where('p.order_id = o.id')
            .andWhere('p.status IN (:...active)')
            .getQuery()}`,
        { active: ACTIVE_PAYMENT_STATUSES },
      )
      .orderBy('o.id', 'ASC')
      .limit(BATCH_LIMIT)
      .getRawMany();

    return rows.map((row) => Number(row.id));
  }
}

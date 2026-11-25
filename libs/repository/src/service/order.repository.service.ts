import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  IsNull,
  LessThan,
  Not,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import { OrderEventEntity } from '../entity/order-event.entity';
import { OrderInvoiceEntity } from '../entity/order-invoice.entity';
import { OrderItemEntity } from '../entity/order-item.entity';
import { OrderShippingEntity } from '../entity/order-shipping.entity';
import { OrderEntity } from '../entity/order.entity';
import { PaymentEntity } from '../entity/payment.entity';
import { InvoiceAdjustStatus, InvoiceStatus } from '../enum/invoice.enum';
import {
  AdminOrderChip,
  DeliveryStage,
  OrderStatus,
  PurchaseStatus,
  UserOrderListFilter,
} from '../enum/order.enum';
import { ACTIVE_PAYMENT_STATUSES } from '../enum/payment.enum';

export interface AdminOrderListQuery {
  chip: AdminOrderChip;
  keyword?: string;
  paidFrom?: Date;
  paidTo?: Date;
  deliveryStage?: DeliveryStage;
  skip: number;
  take: number;
  ascending: boolean;
}

/** 결제 완료 + 미발주 + 취소 미접수 — 24시간 타이머가 도는 주문 */
const OPEN_FOR_PURCHASE = `o.status = :paid AND o.purchase_status = :notOrdered AND o.cancellation_requested_at IS NULL`;

/** order_event.message 칸 길이 */
const EVENT_MESSAGE_MAX = 500;

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
    @InjectRepository(OrderEventEntity)
    private readonly orderEventRepository: Repository<OrderEventEntity>,
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

  /**
   * 발표 행에서 넘긴 칸만 고친다. 엔티티를 통째로 save 하면 읽은 뒤 다른 작업이 바꾼 칸
   * (발행 중에 환불이 끝나 PENDING 이 된 adjust_status 등)을 옛 값으로 덮는다.
   */
  async updateInvoiceFields(
    orderId: number,
    fields: Partial<Omit<OrderInvoiceEntity, 'orderId' | 'order'>>,
  ) {
    return this.orderInvoiceRepository.update({ orderId }, fields);
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

  /**
   * 고객 주문 목록. 대표 상품 1건만 쓰지만 items 를 같이 읽는다 (페이지 크기가 작다).
   * create_date 가 timezone 없는 UTC 벽시계라 기간은 DB 시각으로 자른다.
   */
  async findPageByUserId(
    userId: number,
    filter: UserOrderListFilter,
    months: number | null,
    skip: number,
    take: number,
  ): Promise<[OrderEntity[], number]> {
    const qb = this.orderRepository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'i')
      .where('o.user_id = :userId', { userId });

    this.applyUserFilter(qb, filter);

    if (months) {
      qb.andWhere(
        `o.create_date >= (NOW() AT TIME ZONE 'UTC') - make_interval(months => :months)`,
        { months },
      );
    }

    // 조인 컬럼(i.id)으로 정렬하면 skip/take 가 주문이 아니라 라인 수로 잘린다
    const [orders, total] = await qb
      .orderBy('o.id', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    orders.forEach((order) => order.items?.sort((x, y) => x.id - y.id));

    return [orders, total];
  }

  private applyUserFilter(
    qb: SelectQueryBuilder<OrderEntity>,
    filter: UserOrderListFilter,
  ) {
    const shown = [
      OrderStatus.PAID,
      OrderStatus.PAYMENT_WAITING,
      OrderStatus.CANCELED,
      OrderStatus.FAILED,
    ];
    const params = {
      shown,
      paid: OrderStatus.PAID,
      waiting: OrderStatus.PAYMENT_WAITING,
      closed: [OrderStatus.CANCELED, OrderStatus.FAILED],
      delivered: DeliveryStage.DELIVERED,
    };

    const conditions: Record<UserOrderListFilter, string> = {
      [UserOrderListFilter.ALL]: 'o.status IN (:...shown)',
      [UserOrderListFilter.IN_PROGRESS]:
        '(o.status = :waiting OR (o.status = :paid AND o.delivery_stage <> :delivered))',
      [UserOrderListFilter.COMPLETED]:
        'o.status = :paid AND o.delivery_stage = :delivered',
      [UserOrderListFilter.CANCELED]: 'o.status IN (:...closed)',
    };

    qb.andWhere(conditions[filter], params);
  }

  /** 필터·검색이 걸린 ADMIN 주문 목록. 고객명은 받는 분 이름이다 */
  async findAdminPage(
    query: AdminOrderListQuery,
    now: Date,
  ): Promise<[OrderEntity[], number]> {
    const qb = this.orderRepository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.shipping', 's')
      .where('o.status IN (:...shown)', {
        shown: [OrderStatus.PAID, OrderStatus.PAYMENT_WAITING],
      });

    this.applyAdminChip(qb, query.chip, now);

    if (query.keyword) {
      qb.andWhere(
        `(o.order_number ILIKE :kw OR s.recipient_name ILIKE :kw OR EXISTS (
           SELECT 1 FROM order_item oi
           WHERE oi.order_id = o.id AND oi.product_name_snapshot ILIKE :kw))`,
        { kw: `%${query.keyword.replace(/[%_\\]/g, '\\$&')}%` },
      );
    }

    if (query.paidFrom) {
      qb.andWhere('o.paid_at >= :paidFrom', { paidFrom: query.paidFrom });
    }

    if (query.paidTo) {
      qb.andWhere('o.paid_at < :paidTo', { paidTo: query.paidTo });
    }

    if (query.deliveryStage) {
      qb.andWhere('o.delivery_stage = :stage', { stage: query.deliveryStage });
    }

    return qb
      .orderBy('o.id', query.ascending ? 'ASC' : 'DESC')
      .skip(query.skip)
      .take(query.take)
      .getManyAndCount();
  }

  private applyAdminChip(
    qb: SelectQueryBuilder<OrderEntity>,
    chip: AdminOrderChip,
    now: Date,
  ) {
    const params = {
      paid: OrderStatus.PAID,
      notOrdered: PurchaseStatus.NOT_ORDERED,
      ordered: PurchaseStatus.ORDERED,
      now,
    };
    const waitUntil = `o.paid_at + interval '24 hours'`;

    const conditions: Partial<Record<AdminOrderChip, string>> = {
      [AdminOrderChip.WAITING]: `${OPEN_FOR_PURCHASE} AND ${waitUntil} > :now`,
      [AdminOrderChip.READY]: `${OPEN_FOR_PURCHASE} AND ${waitUntil} <= :now`,
      [AdminOrderChip.CANCEL_REQUESTED]:
        'o.cancellation_requested_at IS NOT NULL',
      [AdminOrderChip.ORDERED]: 'o.purchase_status = :ordered',
    };

    if (conditions[chip]) {
      qb.andWhere(conditions[chip], params);
    }
  }

  /** KPI 4개. 서로 겹칠 수 있어 합산하지 않는다. todayStart 는 Asia/Taipei 자정 */
  async countAdminSummary(
    todayStart: Date,
    now: Date,
  ): Promise<{
    todayNew: number;
    waiting: number;
    ready: number;
    cancelRequested: number;
  }> {
    const count = (chip: AdminOrderChip) => {
      const qb = this.orderRepository
        .createQueryBuilder('o')
        .where('o.status = :statusPaid', { statusPaid: OrderStatus.PAID });

      this.applyAdminChip(qb, chip, now);

      return qb.getCount();
    };

    const [todayNew, waiting, ready, cancelRequested] = await Promise.all([
      this.orderRepository
        .createQueryBuilder('o')
        .where('o.status = :paid', { paid: OrderStatus.PAID })
        .andWhere('o.paid_at >= :todayStart', { todayStart })
        .getCount(),
      count(AdminOrderChip.WAITING),
      count(AdminOrderChip.READY),
      count(AdminOrderChip.CANCEL_REQUESTED),
    ]);

    return { todayNew, waiting, ready, cancelRequested };
  }

  async findAdminDetail(id: number): Promise<OrderEntity | null> {
    return this.orderRepository.findOne({
      where: { id, status: Not(OrderStatus.PENDING) },
      relations: { items: true, shipping: true, invoice: true },
      order: { items: { id: 'ASC' } },
    });
  }

  /**
   * 발주 처리. 결제 완료·미발주·취소 미접수일 때만 고쳐서 버튼 중복 클릭과
   * 취소 접수 경쟁을 DB 한 문장이 막는다. 고쳤으면 true. 트랜잭션 안에서 부른다.
   */
  async markPurchased(
    id: number,
    fields: Pick<
      OrderEntity,
      | 'supplierOrderedAt'
      | 'supplierOrderNo'
      | 'purchaseOverrideReason'
      | 'purchasedByAdminId'
    >,
  ): Promise<boolean> {
    const result = await this.orderRepository
      .createQueryBuilder()
      .update(OrderEntity)
      .set({ ...fields, purchaseStatus: PurchaseStatus.ORDERED })
      .where('id = :id', { id })
      .andWhere('status = :paid', { paid: OrderStatus.PAID })
      .andWhere('purchase_status = :notOrdered', {
        notOrdered: PurchaseStatus.NOT_ORDERED,
      })
      .andWhere('cancellation_requested_at IS NULL')
      .execute();

    if ((result.affected ?? 0) !== 1) {
      return false;
    }

    // 관리자가 이미 단계를 앞으로 옮긴 주문은 되돌리지 않는다
    await this.orderRepository.update(
      { id, deliveryStage: DeliveryStage.ORDER_CONFIRMED },
      { deliveryStage: DeliveryStage.PREPARING_ORDER },
    );

    return true;
  }

  /**
   * 취소·계약해제 통지 접수. 처음 접수한 시각이 통지 시각이라 이미 접수된 건은 덮지 않는다.
   * 발주 여부·배송 단계는 보지 않는다 — 결제 완료 주문이면 받는다. 새로 접수했으면 true.
   */
  async requestCancellation(
    id: number,
    userId: number,
    reason: string | null,
    now: Date,
  ): Promise<boolean> {
    const result = await this.orderRepository.update(
      {
        id,
        userId,
        status: OrderStatus.PAID,
        cancellationRequestedAt: IsNull(),
      },
      { cancellationRequestedAt: now, cancellationReason: reason },
    );

    return (result.affected ?? 0) === 1;
  }

  /** 접수된 취소를 되돌린다 (고객이 철회했을 때). 되돌렸으면 true */
  async withdrawCancellation(id: number): Promise<boolean> {
    const result = await this.orderRepository.update(
      {
        id,
        status: OrderStatus.PAID,
        cancellationRequestedAt: Not(IsNull()),
      },
      { cancellationRequestedAt: null, cancellationReason: null },
    );

    return (result.affected ?? 0) === 1;
  }

  async findByIds(ids: number[]): Promise<OrderEntity[]> {
    return this.orderRepository.find({
      where: { id: In(ids) },
      relations: { shipping: true },
      order: { id: 'ASC' },
    });
  }

  /** 배송 완료가 아니면 수령 시각을 비운다 (단계를 되돌린 경우) */
  async updateDeliveryStage(
    ids: number[],
    deliveryStage: DeliveryStage,
    deliveredAt: Date | null,
  ) {
    return this.orderRepository.update(
      { id: In(ids), status: OrderStatus.PAID },
      { deliveryStage, deliveredAt },
    );
  }

  async updateLocalDelivery(
    id: number,
    fields: Partial<Pick<OrderEntity, 'localCarrier' | 'localTrackingNo'>>,
  ) {
    return this.orderRepository.update({ id }, fields);
  }

  async saveEvents(
    events: Pick<
      OrderEventEntity,
      'orderId' | 'type' | 'adminId' | 'userId' | 'message'
    >[],
  ) {
    // 사유 같은 자유 입력이 붙어 칸 길이를 넘으면 이력 저장이 통째로 실패한다
    return this.orderEventRepository.insert(
      events.map((event) => ({
        ...event,
        message: event.message?.slice(0, EVENT_MESSAGE_MAX) ?? null,
      })),
    );
  }

  async findEventsByOrderId(orderId: number): Promise<OrderEventEntity[]> {
    return this.orderEventRepository.find({
      where: { orderId },
      order: { id: 'DESC' },
    });
  }

  /**
   * 환불이 끝난 주문의 발표를 정정 대기로 돌린다. 이미 정정 중·완료인 건은 건드리지 않는다.
   * 발표가 아직 안 나갔어도 PENDING 으로 둔다 — 발행 중이던 요청이 늦게 성공했을 수 있어
   * 정정 쪽이 ECPay 에 조회해서 가린다.
   */
  async markInvoiceAdjustPending(orderId: number) {
    return this.orderInvoiceRepository.update(
      { orderId, adjustStatus: InvoiceAdjustStatus.NONE },
      { adjustStatus: InvoiceAdjustStatus.PENDING },
    );
  }

  /** 정정이 안 끝난 발표 (배치 재시도). 횟수를 넘긴 건은 관리자가 직접 다시 시도한다 */
  async findInvoicesToAdjust(
    maxAttempts: number,
  ): Promise<OrderInvoiceEntity[]> {
    return this.orderInvoiceRepository.find({
      where: {
        adjustStatus: In([
          InvoiceAdjustStatus.PENDING,
          InvoiceAdjustStatus.FAILED,
        ]),
        adjustAttemptCount: LessThan(maxAttempts),
      },
      order: { orderId: 'ASC' },
      take: BATCH_LIMIT,
    });
  }

  async findInvoicesByOrderIds(
    orderIds: number[],
  ): Promise<OrderInvoiceEntity[]> {
    return orderIds.length
      ? this.orderInvoiceRepository.findBy({ orderId: In(orderIds) })
      : [];
  }
}

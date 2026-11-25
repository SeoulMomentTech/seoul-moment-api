import { DatabaseSort } from '@app/common/enum/global.enum';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { OrderEntity } from '@app/repository/entity/order.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  DeliveryStage,
  FulfillmentTimerState,
  OrderEventType,
  OrderStatus,
} from '@app/repository/enum/order.enum';
import { getTimerState } from '@app/repository/helper/order-status.helper';
import { getOpenRefund } from '@app/repository/helper/refund.helper';
import { OrderRepositoryService } from '@app/repository/service/order.repository.service';
import { PaymentRepositoryService } from '@app/repository/service/payment.repository.service';
import { RefundRepositoryService } from '@app/repository/service/refund.repository.service';
import { ShipmentRepositoryService } from '@app/repository/service/shipment.repository.service';
import { Injectable } from '@nestjs/common';
import moment from 'moment-timezone';
import { Transactional } from 'typeorm-transactional';

import {
  GetAdminOrderDetailResponse,
  GetAdminOrderListItemResponse,
  GetAdminOrderListRequest,
  GetAdminOrderSummaryResponse,
  PatchAdminOrderLocalDeliveryRequest,
  PostAdminOrderDeliveryStageRequest,
  PostAdminOrderPurchaseRequest,
} from './admin.order.dto';

/** 날짜 경계는 모두 대만 현지 기준이다 (명세 v6 §9A.2) */
const TZ = 'Asia/Taipei';

@Injectable()
export class AdminOrderService {
  constructor(
    private readonly orderRepositoryService: OrderRepositoryService,
    private readonly paymentRepositoryService: PaymentRepositoryService,
    private readonly shipmentRepositoryService: ShipmentRepositoryService,
    private readonly refundRepositoryService: RefundRepositoryService,
  ) {}

  async getSummary(): Promise<GetAdminOrderSummaryResponse> {
    const now = new Date();
    const todayStart = moment.tz(now, TZ).startOf('day').toDate();
    const counts = await this.orderRepositoryService.countAdminSummary(
      todayStart,
      now,
    );

    return GetAdminOrderSummaryResponse.from(counts, now);
  }

  async getList(
    query: GetAdminOrderListRequest,
    language?: LanguageCode,
  ): Promise<[GetAdminOrderListItemResponse[], number]> {
    this.assertValidDates(query);

    const now = new Date();
    const [orders, total] = await this.orderRepositoryService.findAdminPage(
      {
        chip: query.chip,
        keyword: query.search?.trim() || undefined,
        paidFrom: query.paidFrom
          ? moment.tz(query.paidFrom, TZ).startOf('day').toDate()
          : undefined,
        // 끝 날짜는 그날 포함이라 다음 날 0시 미만으로 자른다
        paidTo: query.paidTo
          ? moment.tz(query.paidTo, TZ).add(1, 'day').startOf('day').toDate()
          : undefined,
        deliveryStage: query.deliveryStage,
        skip: (query.page - 1) * query.count,
        take: query.count,
        ascending: query.sort === DatabaseSort.ASC,
      },
      now,
    );

    return [
      orders.map((order) =>
        GetAdminOrderListItemResponse.from(order, now, language),
      ),
      total,
    ];
  }

  /** 2026-13-45 같은 값은 정규식을 통과하므로 달력으로 한 번 더 본다 */
  private assertValidDates(query: GetAdminOrderListRequest) {
    for (const value of [query.paidFrom, query.paidTo]) {
      if (value && !moment(value, 'YYYY-MM-DD', true).isValid()) {
        throw new ServiceError(
          `Invalid date: ${value}`,
          ServiceErrorCode.BAD_REQUEST,
        );
      }
    }
  }

  async getDetail(
    id: number,
    language?: LanguageCode,
  ): Promise<GetAdminOrderDetailResponse> {
    const order = await this.orderRepositoryService.findAdminDetail(id);

    if (!order) {
      throw new ServiceError(
        `No exist order ID: ${id}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    const [payment, shipments, events, refunds] = await Promise.all([
      this.paymentRepositoryService.findLatestByOrderId(order.id),
      this.shipmentRepositoryService.findByOrderId(order.id),
      this.orderRepositoryService.findEventsByOrderId(order.id),
      this.refundRepositoryService.findAllByOrderId(order.id),
    ]);

    return GetAdminOrderDetailResponse.from(
      order,
      payment,
      new Date(),
      language,
      { shipments, events, refunds },
    );
  }

  /**
   * 한국 발주 시작. 24시간이 지나야 하고(READY), 그 전이면 사유를 남긴 조기 발주만 된다.
   * 취소·계약해제가 접수됐거나 이미 발주한 주문은 막는다. 실제 공급처 주문은 자동으로
   * 나가지 않으므로 발주번호는 관리자가 입력한다.
   */
  @Transactional()
  async startPurchase(
    adminId: number,
    id: number,
    dto: PostAdminOrderPurchaseRequest,
  ): Promise<void> {
    const order = await this.findOrThrow(id);
    const now = new Date();
    const { isEarly, earlyReason } = this.checkPurchasable(order, dto, now);

    const updated = await this.orderRepositoryService.markPurchased(id, {
      supplierOrderedAt: now,
      supplierOrderNo: dto.supplierOrderNo?.trim() || null,
      purchaseOverrideReason: isEarly ? earlyReason : null,
      purchasedByAdminId: adminId,
    });

    // 읽은 뒤 취소가 접수되거나 다른 관리자가 먼저 발주했다
    if (!updated) {
      throw new ServiceError(
        `Order ${id} was changed and can no longer be purchased`,
        ServiceErrorCode.CONFLICT,
      );
    }

    await this.orderRepositoryService.saveEvents([
      {
        orderId: id,
        type: OrderEventType.PURCHASED,
        adminId,
        userId: null,
        message: isEarly ? `early: ${earlyReason}` : null,
      },
    ]);
  }

  /** 접수된 취소·계약해제를 되돌린다 (고객이 철회했을 때). 다시 발주할 수 있게 된다 */
  @Transactional()
  async withdrawCancelRequest(adminId: number, id: number): Promise<void> {
    const order = await this.findOrThrow(id);

    // 환불 요청을 남긴 채 철회하면 발주된 주문이 나중에 환불 완료로 취소될 수 있다
    if (
      getOpenRefund(await this.refundRepositoryService.findAllByOrderId(id))
    ) {
      throw new ServiceError(
        `Order ${id} has an open refund. Finish or cancel it first`,
        ServiceErrorCode.CONFLICT,
      );
    }
    const withdrawn =
      await this.orderRepositoryService.withdrawCancellation(id);

    if (!withdrawn) {
      throw new ServiceError(
        `Order ${id} has no open cancellation request`,
        ServiceErrorCode.CONFLICT,
      );
    }

    await this.orderRepositoryService.saveEvents([
      {
        orderId: id,
        type: OrderEventType.CANCEL_REQUEST_WITHDRAWN,
        adminId,
        userId: null,
        message: order.cancellationReason,
      },
    ]);
  }

  /**
   * 배송 단계 수동 변경 (여러 주문 한 번에). 통관 상태·발주 여부와 묶지 않는다 —
   * 대만 도착을 통관 완료로, 통관 완료를 국내배송 시작으로 자동 처리하지 않는다.
   */
  @Transactional()
  async changeDeliveryStage(
    adminId: number,
    dto: PostAdminOrderDeliveryStageRequest,
  ): Promise<void> {
    const deliveredAt = this.resolveDeliveredAt(dto);
    const ids = [...new Set(dto.orderIds)];
    const orders = await this.orderRepositoryService.findByIds(ids);
    const paid = orders.filter((order) => order.status === OrderStatus.PAID);

    if (paid.length !== ids.length) {
      const invalid = ids.filter((x) => !paid.some((order) => order.id === x));

      throw new ServiceError(
        `Orders not found or not paid: ${invalid.join(', ')}`,
        ServiceErrorCode.CONFLICT,
      );
    }

    // 같은 단계로 다시 누른 주문은 건드리지 않는다 (수령 시각을 덮지 않게)
    const changed = paid.filter(
      (order) => order.deliveryStage !== dto.deliveryStage || dto.deliveredAt,
    );

    if (changed.length === 0) {
      return;
    }

    await this.orderRepositoryService.updateDeliveryStage(
      changed.map((order) => order.id),
      dto.deliveryStage,
      deliveredAt,
    );
    await this.orderRepositoryService.saveEvents(
      changed.map((order) => ({
        orderId: order.id,
        type: OrderEventType.DELIVERY_STAGE_CHANGED,
        adminId,
        userId: null,
        message: this.describeStageChange(
          order,
          dto.deliveryStage,
          deliveredAt,
        ),
      })),
    );
  }

  /** 수령 시각은 법정 기간의 기준이라, 덮거나 지울 때 이전 값을 이력에 남긴다 */
  private describeStageChange(
    order: OrderEntity,
    to: DeliveryStage,
    deliveredAt: Date | null,
  ): string {
    const stages = `${order.deliveryStage} → ${to}`;

    if (!order.deliveredAt && !deliveredAt) {
      return stages;
    }

    const iso = (value: Date | null) => value?.toISOString() ?? '-';

    return `${stages} (deliveredAt ${iso(order.deliveredAt)} → ${iso(deliveredAt)})`;
  }

  /** 수령 시각은 배송 완료일 때만 있다. 생략하면 지금 */
  private resolveDeliveredAt(
    dto: PostAdminOrderDeliveryStageRequest,
  ): Date | null {
    const isDelivered = dto.deliveryStage === DeliveryStage.DELIVERED;
    const now = new Date();
    const given = dto.deliveredAt ? new Date(dto.deliveredAt) : null;

    if (given && (!isDelivered || given.getTime() > now.getTime())) {
      throw new ServiceError(
        'deliveredAt is only for DELIVERED and cannot be in the future',
        ServiceErrorCode.BAD_REQUEST,
      );
    }

    return isDelivered ? (given ?? now) : null;
  }

  @Transactional()
  async updateLocalDelivery(
    adminId: number,
    id: number,
    dto: PatchAdminOrderLocalDeliveryRequest,
  ): Promise<void> {
    const order = await this.findOrThrow(id);
    const fields: Partial<
      Pick<OrderEntity, 'localCarrier' | 'localTrackingNo'>
    > = {};

    for (const key of ['localCarrier', 'localTrackingNo'] as const) {
      if (dto[key] !== undefined) {
        fields[key] = dto[key]?.trim() || null;
      }
    }

    if (Object.keys(fields).length === 0) {
      throw new ServiceError(
        'localCarrier or localTrackingNo is required',
        ServiceErrorCode.BAD_REQUEST,
      );
    }

    if (order.status !== OrderStatus.PAID) {
      throw new ServiceError(
        `Order ${id} is not a paid order (status=${order.status})`,
        ServiceErrorCode.CONFLICT,
      );
    }

    const merged = { ...order, ...fields };

    await this.orderRepositoryService.updateLocalDelivery(id, fields);
    await this.orderRepositoryService.saveEvents([
      {
        orderId: id,
        type: OrderEventType.LOCAL_DELIVERY_UPDATED,
        adminId,
        userId: null,
        message: `${merged.localCarrier ?? '-'} / ${merged.localTrackingNo ?? '-'}`,
      },
    ]);
  }

  private async findOrThrow(id: number): Promise<OrderEntity> {
    const order = await this.orderRepositoryService.findById(id);

    if (!order) {
      throw new ServiceError(
        `No exist order ID: ${id}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return order;
  }

  /** 발주할 수 있는 상태인지 보고, 조기 발주인지와 그 사유를 돌려준다 */
  private checkPurchasable(
    order: OrderEntity,
    dto: PostAdminOrderPurchaseRequest,
    now: Date,
  ): { isEarly: boolean; earlyReason?: string } {
    const state = getTimerState(order, now);
    const isEarly =
      state === FulfillmentTimerState.WAITING ||
      state === FulfillmentTimerState.SOON;

    if (!isEarly && state !== FulfillmentTimerState.READY) {
      throw new ServiceError(
        `Order ${order.id} cannot be purchased (state=${state})`,
        ServiceErrorCode.CONFLICT,
      );
    }

    const earlyReason = dto.earlyReason?.trim();

    if (isEarly && !earlyReason) {
      throw new ServiceError(
        'earlyReason is required before the 24h wait has passed',
        ServiceErrorCode.BAD_REQUEST,
      );
    }

    return { isEarly, earlyReason };
  }
}

import { DatabaseSort } from '@app/common/enum/global.enum';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { OrderEntity } from '@app/repository/entity/order.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { FulfillmentTimerState } from '@app/repository/enum/order.enum';
import { getTimerState } from '@app/repository/helper/order-status.helper';
import { OrderRepositoryService } from '@app/repository/service/order.repository.service';
import { PaymentRepositoryService } from '@app/repository/service/payment.repository.service';
import { Injectable } from '@nestjs/common';
import moment from 'moment-timezone';

import {
  GetAdminOrderDetailResponse,
  GetAdminOrderListItemResponse,
  GetAdminOrderListRequest,
  GetAdminOrderSummaryResponse,
  PostAdminOrderPurchaseRequest,
} from './admin.order.dto';

/** 날짜 경계는 모두 대만 현지 기준이다 (명세 v6 §9A.2) */
const TZ = 'Asia/Taipei';

@Injectable()
export class AdminOrderService {
  constructor(
    private readonly orderRepositoryService: OrderRepositoryService,
    private readonly paymentRepositoryService: PaymentRepositoryService,
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

    const payment = await this.paymentRepositoryService.findLatestByOrderId(
      order.id,
    );

    return GetAdminOrderDetailResponse.from(
      order,
      payment,
      new Date(),
      language,
    );
  }

  /**
   * 한국 발주 시작. 24시간이 지나야 하고(READY), 그 전이면 사유를 남긴 조기 발주만 된다.
   * 취소·계약해제가 접수됐거나 이미 발주한 주문은 막는다. 실제 공급처 주문은 자동으로
   * 나가지 않으므로 발주번호는 관리자가 입력한다.
   */
  async startPurchase(
    adminId: number,
    id: number,
    dto: PostAdminOrderPurchaseRequest,
  ): Promise<void> {
    const order = await this.orderRepositoryService.findById(id);

    if (!order) {
      throw new ServiceError(
        `No exist order ID: ${id}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

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

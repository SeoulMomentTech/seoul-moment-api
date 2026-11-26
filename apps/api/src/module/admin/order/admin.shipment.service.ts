import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { OrderEntity } from '@app/repository/entity/order.entity';
import { ShipmentEntity } from '@app/repository/entity/shipment.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  CustomsStatus,
  OrderEventType,
  OrderStatus,
} from '@app/repository/enum/order.enum';
import { OrderRepositoryService } from '@app/repository/service/order.repository.service';
import { ShipmentRepositoryService } from '@app/repository/service/shipment.repository.service';
import { Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';

import {
  GetAdminShipmentListRequest,
  GetAdminShipmentResponse,
  PatchAdminShipmentRequest,
  PostAdminShipmentRequest,
  PostAdminShipmentResponse,
} from './admin.shipment.dto';

const TEXT_FIELDS = [
  'intlCarrier',
  'intlTrackingNo',
  'houseAirwaybillNo',
  'importDeclarationNo',
  'memo',
] as const;
const DATE_FIELDS = ['declaredAt', 'clearedAt'] as const;

/**
 * 통관·물류 관리. 법인 통관 내역을 기록만 한다 — 세관 신고나 EZWAY 인증을 대신하지 않는다.
 * 통관 상태를 바꿔도 주문의 배송 단계는 그대로다 (대만 도착 ≠ 통관 완료 ≠ 국내배송 시작).
 */
@Injectable()
export class AdminShipmentService {
  constructor(
    private readonly shipmentRepositoryService: ShipmentRepositoryService,
    private readonly orderRepositoryService: OrderRepositoryService,
  ) {}

  @Transactional()
  async create(
    adminId: number,
    dto: PostAdminShipmentRequest,
  ): Promise<PostAdminShipmentResponse> {
    const orderIds = [...new Set(dto.orderIds)];

    await this.assertPaidOrders(orderIds);

    const entity = this.applyFields(new ShipmentEntity(), dto);

    entity.customsStatus = dto.customsStatus ?? CustomsStatus.WAITING;
    entity.updatedByAdminId = adminId;

    const saved = await this.shipmentRepositoryService.save(entity);

    await this.shipmentRepositoryService.replaceOrders(saved.id, orderIds);
    await this.logEvents(adminId, saved, orderIds, 'created');

    return this.toWriteResponse(saved);
  }

  @Transactional()
  async update(
    adminId: number,
    id: number,
    dto: PatchAdminShipmentRequest,
  ): Promise<PostAdminShipmentResponse> {
    const entity = await this.findOrThrow(id);
    const linked = (await this.shipmentRepositoryService.findLinks([id])).map(
      (link) => link.orderId,
    );
    const orderIds = dto.orderIds ? [...new Set(dto.orderIds)] : linked;

    // 이미 실려 있던 주문은 그 사이 취소됐어도 그대로 둘 수 있다
    await this.assertPaidOrders(orderIds.filter((x) => !linked.includes(x)));

    this.applyFields(entity, dto);
    entity.customsStatus = dto.customsStatus ?? entity.customsStatus;
    entity.updatedByAdminId = adminId;

    const saved = await this.shipmentRepositoryService.save(entity);

    if (dto.orderIds) {
      await this.shipmentRepositoryService.replaceOrders(id, orderIds);
    }

    await this.logEvents(adminId, saved, orderIds, 'updated');
    await this.logEvents(
      adminId,
      saved,
      linked.filter((x) => !orderIds.includes(x)),
      'removed this order',
    );

    return this.toWriteResponse(saved);
  }

  /** 잘못 등록한 묶음을 지운다. 실려 있던 주문의 작업 이력에 한 줄씩 남는다 */
  @Transactional()
  async remove(adminId: number, id: number): Promise<void> {
    const entity = await this.findOrThrow(id);
    const linked = (await this.shipmentRepositoryService.findLinks([id])).map(
      (link) => link.orderId,
    );

    await this.shipmentRepositoryService.remove(id);
    await this.logEvents(adminId, entity, linked, 'deleted');
  }

  async getList(
    query: GetAdminShipmentListRequest,
    language?: LanguageCode,
  ): Promise<[GetAdminShipmentResponse[], number]> {
    const [shipments, total] = await this.shipmentRepositoryService.findPage({
      keyword: query.search?.trim() || undefined,
      customsStatus: query.customsStatus,
      skip: (query.page - 1) * query.count,
      take: query.count,
    });
    const links = await this.shipmentRepositoryService.findLinks(
      shipments.map((shipment) => shipment.id),
    );
    const orders = await this.findOrders(links.map((link) => link.orderId));

    return [
      shipments.map((shipment) =>
        GetAdminShipmentResponse.from(
          shipment,
          links
            .filter((link) => link.shipmentId === shipment.id)
            .map((link) => orders.find((order) => order.id === link.orderId))
            .filter(Boolean),
          language,
        ),
      ),
      total,
    ];
  }

  async getDetail(
    id: number,
    language?: LanguageCode,
  ): Promise<GetAdminShipmentResponse> {
    const entity = await this.findOrThrow(id);
    const links = await this.shipmentRepositoryService.findLinks([id]);
    const orders = await this.findOrders(links.map((link) => link.orderId));

    return GetAdminShipmentResponse.from(entity, orders, language);
  }

  private async findOrders(ids: number[]): Promise<OrderEntity[]> {
    return ids.length ? this.orderRepositoryService.findByIds(ids) : [];
  }

  private async findOrThrow(id: number): Promise<ShipmentEntity> {
    const entity = await this.shipmentRepositoryService.findById(id);

    if (!entity) {
      throw new ServiceError(
        `No exist shipment ID: ${id}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return entity;
  }

  private async assertPaidOrders(orderIds: number[]) {
    const orders = await this.findOrders(orderIds);
    const paid = orders
      .filter((order) => order.status === OrderStatus.PAID)
      .map((order) => order.id);
    const invalid = orderIds.filter((id) => !paid.includes(id));

    if (invalid.length > 0) {
      throw new ServiceError(
        `Orders not found or not paid: ${invalid.join(', ')}`,
        ServiceErrorCode.CONFLICT,
      );
    }
  }

  /** 보낸 값만 고친다. 빈 문자열·null 은 지운다 */
  private applyFields(
    entity: ShipmentEntity,
    dto: PatchAdminShipmentRequest,
  ): ShipmentEntity {
    for (const field of TEXT_FIELDS) {
      if (dto[field] !== undefined) {
        entity[field] = dto[field]?.trim() || null;
      }
    }

    for (const field of DATE_FIELDS) {
      if (dto[field] !== undefined) {
        entity[field] = dto[field] ? new Date(dto[field]) : null;
      }
    }

    // 운송장 번호와 수입신고번호는 서로 다른 번호다 — 같은 칸에 잘못 넣은 것을 잡는다
    if (
      entity.intlTrackingNo &&
      entity.intlTrackingNo === entity.importDeclarationNo
    ) {
      throw new ServiceError(
        'intlTrackingNo and importDeclarationNo must be different numbers',
        ServiceErrorCode.BAD_REQUEST,
      );
    }

    return entity;
  }

  private async logEvents(
    adminId: number,
    shipment: ShipmentEntity,
    orderIds: number[],
    action: string,
  ) {
    const message = [
      `shipment #${shipment.id} ${action}`,
      `intl=${shipment.intlTrackingNo ?? '-'}`,
      `declaration=${shipment.importDeclarationNo ?? '-'}`,
      `customs=${shipment.customsStatus}`,
    ].join(' / ');

    if (orderIds.length === 0) {
      return;
    }

    await this.orderRepositoryService.saveEvents(
      orderIds.map((orderId) => ({
        orderId,
        type: OrderEventType.SHIPMENT_UPDATED,
        adminId,
        userId: null,
        message,
      })),
    );
  }

  private async toWriteResponse(
    shipment: ShipmentEntity,
  ): Promise<PostAdminShipmentResponse> {
    const find = (field: 'intlTrackingNo' | 'importDeclarationNo') =>
      shipment[field]
        ? this.shipmentRepositoryService.findIdsByNumber(
            field,
            shipment[field],
            shipment.id,
          )
        : Promise.resolve([]);

    return PostAdminShipmentResponse.from(
      shipment.id,
      await find('intlTrackingNo'),
      await find('importDeclarationNo'),
    );
  }
}

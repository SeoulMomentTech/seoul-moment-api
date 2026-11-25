import { OrderEntity } from '@app/repository/entity/order.entity';
import { ShipmentEntity } from '@app/repository/entity/shipment.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { CustomsStatus, DeliveryStage } from '@app/repository/enum/order.enum';
import { getDeliveryStageLabel } from '@app/repository/helper/order-status.helper';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type, plainToInstance } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** 한 묶음에 실을 수 있는 주문 수 상한 */
export const MAX_SHIPMENT_ORDER = 200;

export class PostAdminShipmentRequest {
  @ApiProperty({
    description:
      '이 묶음에 실린 주문 ID (1~200개). 결제 완료 주문만 넣을 수 있다. 한 주문이 여러 묶음에 들어가도 된다',
    example: [481, 482],
    type: [Number],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_SHIPMENT_ORDER)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  orderIds: number[];

  @ApiPropertyOptional({ description: '국제운송사', example: 'EMS' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  intlCarrier?: string | null;

  @ApiPropertyOptional({
    description: '국제운송장 번호. 수입신고번호와 같은 값이면 400',
    example: 'EG123456789KR',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  intlTrackingNo?: string | null;

  @ApiPropertyOptional({ description: '분할운송장(HAWB) 번호' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  houseAirwaybillNo?: string | null;

  @ApiPropertyOptional({
    description: '법인 수입신고번호 (통관업자 제공)',
    example: 'AA  26 123 45678',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  importDeclarationNo?: string | null;

  @ApiPropertyOptional({
    description:
      'WAITING 대기 / IN_PROGRESS 진행 / HELD 보류 / CLEARED 완료. 생략하면 WAITING. 배송 단계를 바꾸지 않는다',
    enum: CustomsStatus,
  })
  @IsOptional()
  @IsEnum(CustomsStatus)
  customsStatus?: CustomsStatus;

  @ApiPropertyOptional({
    description: '수입신고 일시 (ISO 8601)',
    example: '2026-11-25T03:00:00Z',
  })
  @IsOptional()
  @IsISO8601()
  declaredAt?: string | null;

  @ApiPropertyOptional({ description: '통관 완료 일시 (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  clearedAt?: string | null;

  @ApiPropertyOptional({ description: '담당자 메모 (1000자, 고객 비노출)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  memo?: string | null;
}

export class PatchAdminShipmentRequest extends PartialType(
  PostAdminShipmentRequest,
) {}

export class GetAdminShipmentListRequest {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기 (최대 100)', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  count: number = 10;

  @ApiPropertyOptional({
    description:
      '국제운송장·분할운송장·수입신고번호·주문번호·대만 운송장 중 하나에 포함되는 글자',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: CustomsStatus })
  @IsOptional()
  @IsEnum(CustomsStatus)
  customsStatus?: CustomsStatus;
}

export class GetAdminShipmentOrderResponse {
  @ApiProperty({ example: 481 })
  orderId: number;

  @ApiProperty({ example: 'SM-20261123-000481' })
  orderNumber: string;

  @ApiPropertyOptional({ description: '받는 분', nullable: true })
  recipientName: string | null;

  @ApiProperty({ description: '주문 상태 코드', example: 'PAID' })
  status: string;

  @ApiProperty({ enum: DeliveryStage })
  deliveryStage: DeliveryStage;

  @ApiProperty({ example: '해외배송 중' })
  deliveryStageLabel: string;

  @ApiPropertyOptional({ description: '대만 국내운송장', nullable: true })
  localTrackingNo: string | null;
}

/** 묶음 한 건의 통관·운송 정보. 주문 상세의 통관·배송 탭에도 같은 모양으로 들어간다 */
export class GetAdminShipmentInfoResponse {
  @ApiProperty({ description: '국제배송 묶음 ID', example: 12 })
  shipmentId: number;

  @ApiPropertyOptional({ nullable: true })
  intlCarrier: string | null;

  @ApiPropertyOptional({ nullable: true })
  intlTrackingNo: string | null;

  @ApiPropertyOptional({ nullable: true })
  houseAirwaybillNo: string | null;

  @ApiPropertyOptional({ nullable: true })
  importDeclarationNo: string | null;

  @ApiProperty({ enum: CustomsStatus })
  customsStatus: CustomsStatus;

  @ApiPropertyOptional({ nullable: true })
  declaredAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  clearedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  memo: string | null;

  @ApiPropertyOptional({
    description: '마지막으로 고친 관리자',
    nullable: true,
  })
  updatedByAdminId: number | null;

  @ApiProperty()
  updatedAt: Date;

  static toInfo(entity: ShipmentEntity) {
    return {
      shipmentId: entity.id,
      intlCarrier: entity.intlCarrier ?? null,
      intlTrackingNo: entity.intlTrackingNo ?? null,
      houseAirwaybillNo: entity.houseAirwaybillNo ?? null,
      importDeclarationNo: entity.importDeclarationNo ?? null,
      customsStatus: entity.customsStatus,
      declaredAt: entity.declaredAt ?? null,
      clearedAt: entity.clearedAt ?? null,
      memo: entity.memo ?? null,
      updatedByAdminId: entity.updatedByAdminId ?? null,
      updatedAt: entity.updateDate,
    };
  }
}

export class GetAdminShipmentResponse extends GetAdminShipmentInfoResponse {
  @ApiProperty({
    description: '이 묶음에 실린 주문',
    type: [GetAdminShipmentOrderResponse],
  })
  orders: GetAdminShipmentOrderResponse[];

  static from(
    entity: ShipmentEntity,
    orders: OrderEntity[],
    language?: LanguageCode,
  ) {
    return plainToInstance(this, {
      ...this.toInfo(entity),
      orders: orders.map((order) => ({
        orderId: order.id,
        orderNumber: order.orderNumber,
        recipientName: order.shipping?.recipientName ?? null,
        status: order.status,
        deliveryStage: order.deliveryStage,
        deliveryStageLabel: getDeliveryStageLabel(
          order.deliveryStage,
          language,
        ),
        localTrackingNo: order.localTrackingNo ?? null,
      })),
    });
  }
}

export class PostAdminShipmentResponse {
  @ApiProperty({ example: 12 })
  shipmentId: number;

  @ApiProperty({
    description:
      '같은 국제운송장 번호를 쓰는 다른 묶음 ID. 저장은 됐고 경고로만 쓴다',
    example: [],
    type: [Number],
  })
  sameIntlTrackingNoShipmentIds: number[];

  @ApiProperty({
    description: '같은 수입신고번호를 쓰는 다른 묶음 ID (경고)',
    example: [],
    type: [Number],
  })
  sameImportDeclarationNoShipmentIds: number[];

  static from(
    shipmentId: number,
    sameIntlTrackingNoShipmentIds: number[],
    sameImportDeclarationNoShipmentIds: number[],
  ) {
    return plainToInstance(this, {
      shipmentId,
      sameIntlTrackingNoShipmentIds,
      sameImportDeclarationNoShipmentIds,
    });
  }
}

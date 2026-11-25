import { OrderInvoiceEntity } from '@app/repository/entity/order-invoice.entity';
import { OrderEntity } from '@app/repository/entity/order.entity';
import { RefundEntity } from '@app/repository/entity/refund.entity';
import {
  InvoiceAdjustStatus,
  InvoiceStatus,
} from '@app/repository/enum/invoice.enum';
import { PaymentMethod } from '@app/repository/enum/order.enum';
import { RefundStatus } from '@app/repository/enum/refund.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PostAdminOrderRefundRequest {
  @ApiPropertyOptional({
    description:
      '환불 근거 (500자). 처음 환불을 시작할 때만 저장되고 재시도에서는 무시된다',
    example: '고객 계약해제 통지 (11/25 접수)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class PostAdminOrderRefundCompleteRequest {
  @ApiProperty({
    description:
      '실제로 돈을 돌려준 근거 (100자). ECPay 후台 退刷 처리번호, 송금 참조번호 등',
    example: 'ECPay 退刷 2611250001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  reference: string;
}

export class GetAdminRefundListRequest {
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

  @ApiPropertyOptional({ enum: RefundStatus })
  @IsOptional()
  @IsEnum(RefundStatus)
  status?: RefundStatus;
}

export class GetAdminRefundResponse {
  @ApiProperty({ example: 7 })
  refundId: number;

  @ApiProperty({ example: 481 })
  orderId: number;

  @ApiProperty({ description: '원 결제 수단', enum: PaymentMethod })
  method: PaymentMethod;

  @ApiProperty({ description: '환불 금액 NT$ (전액)', example: 3880 })
  amount: number;

  @ApiProperty({
    description:
      'REQUESTED 요청됨(수동 환불은 완료 입력 대기) / PROCESSING PG 결과 미확인 — 다시 시도 필요 / COMPLETED 완료 / FAILED PG 거절',
    enum: RefundStatus,
  })
  status: RefundStatus;

  @ApiProperty({
    description:
      'true 면 PG 환불 API 를 쓰지 않는다 (ECPay 카드·ATM·편의점). 관리자가 직접 환불한 뒤 /refund/complete 로 완료를 입력한다',
  })
  isManual: boolean;

  @ApiPropertyOptional({ nullable: true })
  reason: string | null;

  @ApiPropertyOptional({
    description: 'LINE Pay 환불 거래번호, 수동 환불이면 입력한 참조번호',
    nullable: true,
  })
  pgRefundId: string | null;

  @ApiProperty({ description: 'PG 환불 요청 횟수', example: 1 })
  attemptCount: number;

  @ApiPropertyOptional({ nullable: true })
  failureCode: string | null;

  @ApiPropertyOptional({ nullable: true })
  failureMessage: string | null;

  @ApiProperty({ description: '환불을 시작한 관리자 ID' })
  adminId: number;

  @ApiProperty()
  requestedAt: Date;

  @ApiPropertyOptional({ nullable: true })
  completedAt: Date | null;

  static toPlain(entity: RefundEntity) {
    return {
      refundId: entity.id,
      orderId: entity.orderId,
      method: entity.method,
      amount: entity.amount,
      status: entity.status,
      isManual: entity.isManual,
      reason: entity.reason ?? null,
      pgRefundId: entity.pgRefundId ?? null,
      attemptCount: entity.attemptCount,
      failureCode: entity.failureCode ?? null,
      failureMessage: entity.failureMessage ?? null,
      adminId: entity.adminId,
      requestedAt: entity.requestedAt,
      completedAt: entity.completedAt ?? null,
    };
  }

  static from(entity: RefundEntity) {
    return plainToInstance(this, this.toPlain(entity));
  }
}

/** 환불(PG) 결과와 따로 보는 전자발표 정정 결과 */
export class GetAdminInvoiceAdjustmentResponse {
  @ApiProperty({
    description: '발행 상태. PENDING·FAILED 면 발행된 적이 없다 (未開立)',
    enum: InvoiceStatus,
  })
  invoiceStatus: InvoiceStatus;

  @ApiPropertyOptional({ nullable: true, example: 'LY74004967' })
  invoiceNo: string | null;

  @ApiProperty({
    description:
      'NONE 정정할 것 없음 / PENDING 정정 대기 / VOIDED 作廢 / ALLOWANCED 折讓 / FAILED 실패 — /invoice-adjust 로 다시 시도',
    enum: InvoiceAdjustStatus,
  })
  adjustStatus: InvoiceAdjustStatus;

  @ApiPropertyOptional({ description: '折讓單 번호', nullable: true })
  allowanceNo: string | null;

  @ApiPropertyOptional({ nullable: true })
  adjustedAt: Date | null;

  @ApiProperty({ example: 1 })
  attemptCount: number;

  @ApiPropertyOptional({ nullable: true })
  failureCode: string | null;

  @ApiPropertyOptional({ nullable: true })
  failureMessage: string | null;

  static toPlain(entity: OrderInvoiceEntity) {
    return {
      invoiceStatus: entity.status,
      invoiceNo: entity.invoiceNo ?? null,
      adjustStatus: entity.adjustStatus,
      allowanceNo: entity.allowanceNo ?? null,
      adjustedAt: entity.adjustedAt ?? null,
      attemptCount: entity.adjustAttemptCount,
      failureCode: entity.adjustFailureCode ?? null,
      failureMessage: entity.adjustFailureMessage ?? null,
    };
  }

  static from(entity: OrderInvoiceEntity) {
    return plainToInstance(this, this.toPlain(entity));
  }
}

export class GetAdminRefundListItemResponse extends GetAdminRefundResponse {
  @ApiPropertyOptional({ example: 'SM-20261123-000481', nullable: true })
  orderNumber: string | null;

  @ApiPropertyOptional({ description: '받는 분', nullable: true })
  recipientName: string | null;

  @ApiPropertyOptional({
    description: '취소·계약해제 통지 접수 시각',
    nullable: true,
  })
  cancellationRequestedAt: Date | null;

  @ApiPropertyOptional({
    description: '전자발표 정정 결과. 발표 행이 없는 주문이면 null',
    type: GetAdminInvoiceAdjustmentResponse,
    nullable: true,
  })
  invoiceAdjustment: GetAdminInvoiceAdjustmentResponse | null;

  static of(
    entity: RefundEntity,
    order?: OrderEntity,
    invoice?: OrderInvoiceEntity,
  ) {
    return plainToInstance(this, {
      ...this.toPlain(entity),
      orderNumber: order?.orderNumber ?? null,
      recipientName: order?.shipping?.recipientName ?? null,
      cancellationRequestedAt: order?.cancellationRequestedAt ?? null,
      invoiceAdjustment: invoice
        ? GetAdminInvoiceAdjustmentResponse.toPlain(invoice)
        : null,
    });
  }
}

import { OrderEntity } from '@app/repository/entity/order.entity';
import { PaymentEntity } from '@app/repository/entity/payment.entity';
import { OrderStatus, PaymentMethod } from '@app/repository/enum/order.enum';
import { PaymentStatus } from '@app/repository/enum/payment.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

export class PaymentDepositInfoResponse {
  @ApiProperty({
    description:
      'ECPay 결제수단 (ATM_LAND, ATM_TAISHIN, CVS_CVS 등). ATM_ 으로 시작하면 계좌이체, CVS_ 면 편의점 납부',
    example: 'ATM_LAND',
  })
  paymentType: string;

  @ApiPropertyOptional({ description: 'ATM 은행 코드', example: '005' })
  bankCode?: string;

  @ApiPropertyOptional({
    description: 'ATM 가상계좌',
    example: '5219111913127434',
  })
  account?: string;

  @ApiPropertyOptional({
    description: '편의점 납부 코드',
    example: 'LLL22251222',
  })
  paymentNo?: string;
}

export class GetOrderPaymentResponse {
  @ApiProperty({ description: '결제 시도 ID', example: 12 })
  paymentId: number;

  @ApiProperty({
    description: '결제 수단',
    enum: PaymentMethod,
    example: PaymentMethod.ECPAY,
  })
  method: PaymentMethod;

  @ApiProperty({
    description:
      '결제 시도 상태. REQUESTED 결제 중 / WAITING_DEPOSIT 입금 대기 / PAID 완료 / FAILED · CANCELED · EXPIRED 결제 안 됨(같은 주문으로 다시 결제 가능)',
    enum: PaymentStatus,
    example: PaymentStatus.WAITING_DEPOSIT,
  })
  status: PaymentStatus;

  @ApiProperty({ description: '결제 금액', example: 960 })
  amount: number;

  @ApiPropertyOptional({
    description: 'PG 가 알려준 실제 결제수단 (Credit_CreditCard, ATM_LAND …)',
    example: 'ATM_LAND',
    nullable: true,
  })
  pgPaymentType: string | null;

  @ApiPropertyOptional({
    description: 'ATM 계좌 · 편의점 코드. 입금 대기일 때만 있다',
    type: PaymentDepositInfoResponse,
    nullable: true,
  })
  depositInfo: PaymentDepositInfoResponse | null;

  @ApiPropertyOptional({
    description: '입금 기한 (ATM · 편의점)',
    nullable: true,
  })
  expireAt: Date | null;

  @ApiPropertyOptional({ description: '결제 완료 시각', nullable: true })
  paidAt: Date | null;

  @ApiPropertyOptional({
    description: '실패 사유 코드 (PG 응답 코드)',
    nullable: true,
  })
  failureCode: string | null;

  static from(payment: PaymentEntity): GetOrderPaymentResponse {
    return plainToInstance(this, {
      paymentId: payment.id,
      method: payment.method,
      status: payment.status,
      amount: payment.amount,
      pgPaymentType: payment.pgPaymentType,
      depositInfo: payment.depositInfo,
      expireAt: payment.expireAt,
      paidAt: payment.paidAt,
      failureCode: payment.failureCode,
    });
  }
}

export class PostUserPaymentResponse {
  @ApiProperty({ description: '결제 시도 ID', example: 12 })
  paymentId: number;

  @ApiProperty({
    description: '결제 수단',
    enum: PaymentMethod,
    example: PaymentMethod.ECPAY,
  })
  method: PaymentMethod;

  @ApiPropertyOptional({
    description:
      'ECPAY — 이 URL 로 브라우저를 보낸다. LINE 안이면 외부 브라우저로 연다 (LIFF: liff.openWindow({ url, external: true }), 그 밖 LINE 인앱: ?openExternalBrowser=1). 30분 안에 한 번만 열 수 있다',
    example: 'https://api-dev.seoulmoment.com.tw/payment/ecpay/handoff/Xy9...',
    nullable: true,
  })
  handoffUrl: string | null;

  @ApiPropertyOptional({
    description: 'LINE_PAY — 결제 페이지 (웹)',
    example: 'https://sandbox-web-pay.line.me/web/payment/wait?...',
    nullable: true,
  })
  paymentUrl: string | null;

  @ApiPropertyOptional({
    description: 'LINE_PAY — LINE 앱으로 여는 결제 페이지',
    example: 'line://pay/payment/...',
    nullable: true,
  })
  appUrl: string | null;

  @ApiProperty({
    description:
      '로그인 없이 결제 결과를 보는 토큰. 결제 후 결과 페이지(?h=)로 넘어오는 값과 같다. GET /payment/result/{token}',
    example: 'Xy9...',
  })
  resultToken: string;

  static ecpay(payment: PaymentEntity, handoffUrl: string) {
    return plainToInstance(this, {
      paymentId: payment.id,
      method: payment.method,
      handoffUrl,
      paymentUrl: null,
      appUrl: null,
      resultToken: payment.accessToken,
    });
  }

  static linePay(
    payment: PaymentEntity,
    paymentUrl: string | null,
    appUrl: string | null,
  ) {
    return plainToInstance(this, {
      paymentId: payment.id,
      method: payment.method,
      handoffUrl: null,
      paymentUrl,
      appUrl,
      resultToken: payment.accessToken,
    });
  }
}

/** 로그인 없이 보는 결과. 이름·주소·전화번호는 넣지 않는다 */
export class GetPaymentResultResponse {
  @ApiProperty({ description: '주문 ID', example: 481 })
  orderId: number;

  @ApiProperty({ description: '주문번호', example: 'SM-20260903-000481' })
  orderNumber: string;

  @ApiProperty({
    description: '주문 상태',
    enum: OrderStatus,
    example: OrderStatus.PAID,
  })
  orderStatus: OrderStatus;

  @ApiProperty({ description: '결제 시도', type: GetOrderPaymentResponse })
  payment: GetOrderPaymentResponse;

  static from(order: OrderEntity, payment: PaymentEntity) {
    return plainToInstance(this, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      payment: GetOrderPaymentResponse.from(payment),
    });
  }
}

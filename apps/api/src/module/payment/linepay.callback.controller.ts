import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';

import { LinePayPaymentService } from './linepay-payment.service';
import { PaymentResultService } from './payment-result.service';

/**
 * LINE Pay 가 브라우저를 돌려보내는 주소 (프론트용 아님 → Swagger 에서 뺀다).
 * orderId · transactionId 는 LINE Pay 가 자동으로 붙인다. 우리가 URL 에 넣지 않는다.
 */
@ApiExcludeController()
@Controller('payment/linepay')
export class LinePayCallbackController {
  private readonly logger = new Logger(LinePayCallbackController.name);

  constructor(
    private readonly linePayPaymentService: LinePayPaymentService,
    private readonly paymentResultService: PaymentResultService,
  ) {}

  @Get('confirm')
  async confirm(
    @Query('orderId') orderId: string,
    @Query('transactionId') transactionId: string,
    @Res() res: Response,
  ): Promise<void> {
    const payment = await this.linePayPaymentService
      .confirm(String(orderId ?? ''), String(transactionId ?? ''))
      .catch((error) => {
        this.logger.error(`LINE Pay confirm failed: ${error}`);

        return null;
      });

    await this.paymentResultService.respond(res, payment);
  }

  @Get('cancel')
  async cancel(
    @Query('orderId') orderId: string,
    @Query('transactionId') transactionId: string,
    @Res() res: Response,
  ): Promise<void> {
    const payment = await this.linePayPaymentService
      .cancel(String(orderId ?? ''), String(transactionId ?? ''))
      .catch((error) => {
        this.logger.error(`LINE Pay cancel failed: ${error}`);

        return null;
      });

    await this.paymentResultService.respond(res, payment);
  }
}

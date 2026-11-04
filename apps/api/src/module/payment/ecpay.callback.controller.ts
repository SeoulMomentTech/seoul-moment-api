import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';

import { EcpayPaymentService, HtmlPage } from './ecpay-payment.service';
import { PaymentResultService } from './payment-result.service';

/**
 * ECPay 가 부르는 주소들 (프론트용 아님 → Swagger 에서 뺀다).
 *
 * 본문을 DTO 로 받지 않는다. 전역 ValidationPipe 가 forbidNonWhitelisted 라 ECPay 가
 * 보내는 필드 하나만 DTO 에 없어도 400 이 나고, ECPay 는 "1|OK" 를 받을 때까지 재전송한다.
 * Record<string, string> 은 메타타입이 Object 라 검증을 건너뛴다.
 * 예외가 나도 전역 필터가 JSON 을 뱉지 않게 여기서 잡는다.
 */
@ApiExcludeController()
@Controller('payment/ecpay')
export class EcpayCallbackController {
  private readonly logger = new Logger(EcpayCallbackController.name);

  constructor(
    private readonly ecpayPaymentService: EcpayPaymentService,
    private readonly paymentResultService: PaymentResultService,
  ) {}

  /** ReturnURL — 결제 결과 (서버→서버) */
  @Post('return')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async handleReturn(@Body() body: Record<string, string>): Promise<string> {
    try {
      return await this.ecpayPaymentService.handleReturn(body);
    } catch (error) {
      this.logger.error(`ECPay ReturnURL failed: ${error}`);

      return '0|Error';
    }
  }

  /** PaymentInfoURL — ATM·편의점 번호 발급 (서버→서버) */
  @Post('payment-info')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async handlePaymentInfo(
    @Body() body: Record<string, string>,
  ): Promise<string> {
    try {
      return await this.ecpayPaymentService.handlePaymentInfo(body);
    } catch (error) {
      this.logger.error(`ECPay PaymentInfoURL failed: ${error}`);

      return '0|Error';
    }
  }

  /** OrderResultURL · ClientRedirectURL — 결제창을 마친 브라우저를 결과 화면으로 보낸다 */
  @Post('browser-return')
  async browserReturn(
    @Body() body: Record<string, string>,
    @Res() res: Response,
  ): Promise<void> {
    const payment = await this.ecpayPaymentService
      .resolveBrowserReturn(body)
      .catch(() => null);

    await this.paymentResultService.respond(res, payment);
  }

  /**
   * 결제창 진입 페이지. LINE 안에서 외부 브라우저로 넘길 때도 이 URL 하나로 연다.
   * GET 은 링크를 소모하지 않고 같은 주소로 POST 하는 페이지만 준다 — 메신저 미리보기 봇 대비.
   */
  @Get('handoff/:token')
  async handoffLanding(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const page = await this.ecpayPaymentService.renderHandoffLanding(token);

    this.sendPage(res, page);
  }

  /** 중간 페이지가 보내는 POST. 여기서 한 번만 열리게 표시하고 ECPay 로 넘긴다 */
  @Post('handoff/:token')
  async handoff(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const page = await this.ecpayPaymentService.renderHandoff(token);

    this.sendPage(res, page);
  }

  private sendPage(res: Response, page: HtmlPage): void {
    res
      .status(page.status)
      .type('html')
      .set('Cache-Control', 'no-store')
      .send(page.html);
  }
}

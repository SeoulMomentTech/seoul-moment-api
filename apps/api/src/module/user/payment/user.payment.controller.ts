import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  Controller,
  Headers,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation } from '@nestjs/swagger';
import { UserOneTimeTokenGuard } from 'apps/api/src/guard/user-one-time-token.guard';

import { PaymentStartService } from '../../payment/payment-start.service';
import { PostUserPaymentResponse } from '../../payment/payment.dto';

@Controller('user/order')
export class UserPaymentController {
  constructor(private readonly paymentStartService: PaymentStartService) {}

  @Post(':id(\\d+)/payment')
  @ApiOperation({
    summary: '결제 시작 (주문 생성 직후 · 결제창 이탈 후 다시 결제)',
    description:
      '주문(PENDING)의 결제수단으로 결제를 시작한다. 이때 **재고를 잡는다** — 모자라면 409 이고 PG 로 넘어가지 않는다. ' +
      '진행 중인 이전 시도가 있으면 취소로 닫고 새로 만든다(재고는 이어받는다). ' +
      'ECPAY: handoffUrl 로 브라우저를 보낸다. LINE 안이면 외부 브라우저로 연다 — LIFF 는 liff.openWindow({ url, external: true }), ' +
      '그 밖 LINE 인앱 브라우저는 URL 에 ?openExternalBrowser=1. handoffUrl 은 30분 안에 한 번만 열린다. ' +
      'LINE_PAY: paymentUrl(웹) 또는 appUrl(LINE 앱)로 보낸다. ' +
      '결제가 끝나면 브라우저는 {STOREFRONT}/payment/result?h={resultToken} 으로 돌아온다.',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: false,
    description:
      'ECPay 결제창 언어 (ko → 한국어, en → 영어, 그 밖 → 번체 중문)',
    enum: LanguageCode,
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseData(PostUserPaymentResponse, HttpStatus.CREATED)
  @ResponseException(HttpStatus.NOT_FOUND, 'Order not found')
  @ResponseException(
    HttpStatus.CONFLICT,
    'Order is not payable (already paid / waiting deposit / canceled) or some items are out of stock (data.productVariantIds)',
  )
  @ResponseException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    'LINE Pay request failed — 재고는 돌려놓았으니 다시 시도할 수 있다',
  )
  async postUserOrderPayment(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Headers('Accept-language') acceptLanguage?: LanguageCode,
  ): Promise<ResponseDataDto<PostUserPaymentResponse>> {
    const data = await this.paymentStartService.start(
      req.user.id,
      id,
      acceptLanguage,
    );

    return new ResponseDataDto(data);
  }
}

import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseDataDto } from '@app/common/type/response-data';
import { Controller, Get, HttpStatus, Param } from '@nestjs/common';
import { ApiOperation, ApiParam } from '@nestjs/swagger';

import { PaymentResultService } from './payment-result.service';
import { GetPaymentResultResponse } from './payment.dto';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentResultService: PaymentResultService) {}

  @Get('result/:token')
  @ApiOperation({
    summary: '결제 결과 조회 (로그인 없이)',
    description:
      '결제를 마친 브라우저는 {STOREFRONT}/payment/result?h={token} 으로 돌아온다. 그 h 값으로 부른다. ' +
      'LINE 안에서 외부 브라우저로 넘겨 결제하면 그 브라우저에는 로그인 토큰이 없어서 토큰으로 연다. ' +
      '주문번호·주문 상태·결제 상태·입금 정보(ATM 계좌·편의점 코드·기한)만 준다 — 이름·주소·전화번호는 없다. ' +
      'payment.status 가 REQUESTED 면 결과가 아직 안 온 것이니 몇 초 간격으로 다시 부른다. 7일 지나면 404.',
  })
  @ApiParam({
    name: 'token',
    description: '결제 결과 토큰 (resultToken / ?h=)',
  })
  @ResponseData(GetPaymentResultResponse)
  @ResponseException(HttpStatus.NOT_FOUND, 'No exist payment result')
  async getResult(
    @Param('token') token: string,
  ): Promise<ResponseDataDto<GetPaymentResultResponse>> {
    const data = await this.paymentResultService.getResult(token);

    return new ResponseDataDto(data);
  }
}

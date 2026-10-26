import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UserOneTimeTokenGuard } from 'apps/api/src/guard/user-one-time-token.guard';

import { InvoiceValidationService } from '../../invoice/invoice-validation.service';
import { GetInvoiceCheckResponse } from '../../invoice/invoice.dto';

/**
 * 주문서의 전자발표 입력값 확인. 입력이 끝났을 때(blur·제출 직전) 부르고 키 입력마다 부르지 않는다.
 * 같은 값은 서버가 하루 동안 기억한다.
 */
@Controller('user/invoice')
export class UserInvoiceController {
  constructor(
    private readonly invoiceValidationService: InvoiceValidationService,
  ) {}

  @Get('mobile-barcode/check')
  @ApiOperation({
    summary: '휴대폰 바코드 載具 확인',
    description:
      '"/" + 7자(영문 대문자·숫자·+-.). 재정부 장애로 확인을 못 하면 형식만 맞을 때 valid=true, verified=false 다 — 그대로 주문해도 된다.',
  })
  @ApiQuery({ name: 'code', example: '/ABC1234' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseData(GetInvoiceCheckResponse)
  async checkMobileBarcode(
    @Query('code') code: string,
  ): Promise<ResponseDataDto<GetInvoiceCheckResponse>> {
    const data = await this.invoiceValidationService.checkMobileBarcode(code);

    return new ResponseDataDto(data);
  }

  @Get('love-code/check')
  @ApiOperation({
    summary: '기부 愛心碼 확인',
    description:
      '숫자 3–7자리. valid=true 면 name 에 기부처 이름이 온다. 없는 코드로 주문하면 400 이다 — ECPay 발행은 코드를 검사하지 않아서 서버가 막는다.',
  })
  @ApiQuery({ name: 'code', example: '168001' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseData(GetInvoiceCheckResponse)
  async checkLoveCode(
    @Query('code') code: string,
  ): Promise<ResponseDataDto<GetInvoiceCheckResponse>> {
    const data = await this.invoiceValidationService.checkLoveCode(code);

    return new ResponseDataDto(data);
  }

  @Get('company/check')
  @ApiOperation({
    summary: '統一編號 확인 · 회사명 조회',
    description:
      '8자리 검사코드를 확인한다. 회사명은 공개 데이터에 있을 때만 name 에 온다(없어도 valid=true 면 주문 가능) — 회사명 입력칸을 미리 채우는 용도다.',
  })
  @ApiQuery({ name: 'taxId', example: '97025978' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseData(GetInvoiceCheckResponse)
  async checkCompany(
    @Query('taxId') taxId: string,
  ): Promise<ResponseDataDto<GetInvoiceCheckResponse>> {
    const data = await this.invoiceValidationService.checkCompany(taxId);

    return new ResponseDataDto(data);
  }
}

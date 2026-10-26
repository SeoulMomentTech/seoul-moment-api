import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseDataDto } from '@app/common/type/response-data';
import { CvsChain } from '@app/repository/enum/order.enum';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiExcludeEndpoint,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';

import { CvsStoreService } from './cvs-store.service';
import { GetCvsStoreResponse } from './logistics.dto';

@Controller('logistics/cvs')
export class LogisticsController {
  constructor(private readonly cvsStoreService: CvsStoreService) {}

  @Get('map')
  @ApiOperation({
    summary: '편의점 매장 선택 — ECPay 전자지도 열기',
    description:
      '이 URL 로 브라우저를 보낸다(같은 탭). 서버가 ECPay 전자지도로 auto-submit 하는 페이지를 준다. ' +
      '매장을 고르면 {returnUrl}?cvsStoreToken={token} 으로 돌아온다 — returnUrl 은 프론트 주소(STOREFRONT_BASE_URL)로 시작해야 하고, ' +
      '아니면 무시하고 서버가 고른 매장을 보여준다. 페이지를 떠나므로 주문서 입력값은 프론트가 보관해 둔다. ' +
      'ECPay 테스트 환경(logistics-stage)에서는 지도가 뜨지 않고 ECPay 가 고정 매장을 돌려준다.',
  })
  @ApiQuery({ name: 'chain', enum: CvsChain, description: '편의점 체인' })
  @ApiQuery({
    name: 'returnUrl',
    required: false,
    description: '매장을 고른 뒤 돌아올 프론트 주소 (주문서)',
  })
  async openMap(
    @Query('chain') chain: CvsChain,
    @Query('returnUrl') returnUrl: unknown,
    @Headers('user-agent') userAgent: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const html = await this.cvsStoreService.renderMapPage(
      chain,
      returnUrl,
      userAgent,
    );

    res.status(200).type('html').set('Cache-Control', 'no-store').send(html);
  }

  /** ECPay 전자지도가 브라우저로 POST 하는 ServerReplyURL */
  @Post('map/reply')
  @ApiExcludeEndpoint()
  async mapReply(
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ): Promise<void> {
    const reply = await this.cvsStoreService.handleMapReply(body);

    if (reply.redirectUrl) {
      res.redirect(303, reply.redirectUrl);

      return;
    }

    res.status(200).type('html').send(reply.html);
  }

  @Get('store/:token')
  @ApiOperation({
    summary: '고른 편의점 매장 조회',
    description:
      '전자지도에서 돌아올 때 받은 cvsStoreToken 으로 매장 정보를 가져와 주문서에 보여준다. 1시간 지나면 404 — 다시 고르게 한다.',
  })
  @ApiParam({ name: 'token', description: 'cvsStoreToken' })
  @ResponseData(GetCvsStoreResponse)
  @ResponseException(HttpStatus.NOT_FOUND, 'No exist CVS store (expired)')
  async getStore(
    @Param('token') token: string,
  ): Promise<ResponseDataDto<GetCvsStoreResponse>> {
    const data = await this.cvsStoreService.getStore(token);

    return new ResponseDataDto(data);
  }
}

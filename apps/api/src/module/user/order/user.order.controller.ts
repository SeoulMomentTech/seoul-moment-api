import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  Body,
  Controller,
  Get,
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

import {
  GetUserOrderResponse,
  PostUserOrderPreviewRequest,
  PostUserOrderPreviewResponse,
  PostUserOrderRequest,
  PostUserOrderResponse,
} from './user.order.dto';
import { UserOrderService } from './user.order.service';

@Controller('user/order')
export class UserOrderController {
  constructor(private readonly userOrderService: UserOrderService) {}

  @Post('preview')
  @ApiOperation({
    summary: '주문서 금액 미리보기 (장바구니 주문 · 상품상세 구매하기)',
    description:
      '장바구니에서 주문하면 cartItemIds, 상품상세 "구매하기" 면 items[{productVariantId, quantity}] 를 보낸다. 둘 중 정확히 하나만 보낸다. ' +
      '"구매하기" 는 장바구니에 저장하지 않고, 이미 담긴 수량과 합산하지도 않는다. ' +
      '배송비가 배송지 지역으로 정해지므로 縣市·區 를 함께 받는다. 생략하면 본섬 기준 예상 배송비(isShippingEstimated=true)다. ' +
      '주소를 바꾸면 다시 호출해야 한다. DB 를 변경하지 않는다.',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseData(PostUserOrderPreviewResponse)
  @ResponseException(
    HttpStatus.NOT_FOUND,
    'Cart item or product variant not found',
  )
  @ResponseException(
    HttpStatus.BAD_REQUEST,
    'Exactly one of cartItemIds or items is required',
  )
  async postUserOrderPreview(
    @Request() req: any,
    @Body() body: PostUserOrderPreviewRequest,
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): Promise<ResponseDataDto<PostUserOrderPreviewResponse>> {
    const data = await this.userOrderService.preview(
      req.user.id,
      body,
      acceptLanguage,
    );

    return new ResponseDataDto(data);
  }

  @Post()
  @ApiOperation({
    summary: '주문 생성 (결제하기 직전)',
    description:
      'preview 와 같이 cartItemIds 또는 items("구매하기") 중 하나를 보낸다. ' +
      '주문은 PENDING 으로 생성되고 재고는 차감하지 않는다. 장바구니도 비우지 않는다 — 결제 성공 후에 비운다.',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseData(PostUserOrderResponse, HttpStatus.CREATED)
  @ResponseException(
    HttpStatus.NOT_FOUND,
    'Cart item or product variant not found',
  )
  @ResponseException(HttpStatus.CONFLICT, 'Some cart items are not purchasable')
  @ResponseException(
    HttpStatus.BAD_REQUEST,
    'Shipping address is incomplete / exactly one of cartItemIds or items is required',
  )
  async postUserOrder(
    @Request() req: any,
    @Body() body: PostUserOrderRequest,
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): Promise<ResponseDataDto<PostUserOrderResponse>> {
    const data = await this.userOrderService.createOrder(
      req.user.id,
      body,
      acceptLanguage,
    );

    return new ResponseDataDto(data);
  }

  @Get(':id(\\d+)')
  @ApiOperation({ summary: '주문 상세 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseData(GetUserOrderResponse)
  @ResponseException(HttpStatus.NOT_FOUND, 'Order not found')
  async getUserOrder(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetUserOrderResponse>> {
    const data = await this.userOrderService.getOrder(req.user.id, id);

    return new ResponseDataDto(data);
  }
}

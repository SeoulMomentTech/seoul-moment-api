import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation } from '@nestjs/swagger';
import { UserOneTimeTokenGuard } from 'apps/api/src/guard/user-one-time-token.guard';

import {
  DeleteUserCartRequest,
  GetUserCartCountResponse,
  GetUserCartResponse,
  PatchUserCartRequest,
  PostUserCartRequest,
  PostUserCartResponse,
} from './user.cart.dto';
import { UserCartService } from './user.cart.service';

@Controller('user/cart')
export class UserCartController {
  constructor(private readonly userCartService: UserCartService) {}

  @Post()
  @ApiOperation({
    summary: '장바구니 담기 (단건 · 다건)',
    description:
      '상품상세에서 옵션 조합을 여러 개 골라 한 번에 담을 수 있어 items 는 항상 배열이다. 한 개만 담을 때도 길이 1 배열로 보낸다. ' +
      '이미 담긴 SKU 면 라인을 늘리지 않고 수량을 더한다. ' +
      '하나라도 담을 수 없으면 전부 담지 않는다 — 재고가 모자라면 409 의 data 에 어느 SKU 가 몇 개 남았는지 실어 보낸다. ' +
      '헤더 뱃지를 바로 갱신할 수 있도록 담은 뒤의 총 라인 수를 함께 반환한다.',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseData(PostUserCartResponse, HttpStatus.CREATED)
  @ResponseException(HttpStatus.NOT_FOUND, 'Product variant not found')
  @ResponseException(HttpStatus.CONFLICT, 'Not enough stock')
  @ResponseException(HttpStatus.BAD_REQUEST, 'Bad request')
  async postUserCart(
    @Request() req: any,
    @Body() body: PostUserCartRequest,
  ): Promise<ResponseDataDto<PostUserCartResponse>> {
    const data = await this.userCartService.createCartItems(req.user.id, body);

    return new ResponseDataDto(data);
  }

  @Get()
  @ApiOperation({
    summary: '장바구니 조회',
    description:
      '브랜드별 묶음은 표시용이고 배송비는 주문 1건당 1회다. 배송지가 아직 없어 배송비는 본섬 기준 예상값이다.',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseData(GetUserCartResponse)
  @ResponseException(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal server error')
  async getUserCart(
    @Request() req: any,
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): Promise<ResponseDataDto<GetUserCartResponse>> {
    const data = await this.userCartService.getCart(
      req.user.id,
      acceptLanguage,
    );

    return new ResponseDataDto(data);
  }

  @Get('count')
  @ApiOperation({ summary: '장바구니 라인 수 조회 (헤더 뱃지용)' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @ResponseData(GetUserCartCountResponse)
  async getUserCartCount(
    @Request() req: any,
  ): Promise<ResponseDataDto<GetUserCartCountResponse>> {
    const count = await this.userCartService.getCount(req.user.id);

    return new ResponseDataDto(GetUserCartCountResponse.from(count));
  }

  @Patch(':id(\\d+)')
  @ApiOperation({ summary: '장바구니 수량 변경' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseException(HttpStatus.NOT_FOUND, 'Cart item not found')
  @ResponseException(HttpStatus.CONFLICT, 'Not enough stock')
  async patchUserCart(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchUserCartRequest,
  ): Promise<void> {
    await this.userCartService.updateQuantity(req.user.id, id, body.quantity);
  }

  @Delete(':id(\\d+)')
  @ApiOperation({ summary: '장바구니 라인 삭제' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseException(HttpStatus.NOT_FOUND, 'Cart item not found')
  async deleteUserCartItem(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.userCartService.deleteCartItem(req.user.id, id);
  }

  @Delete()
  @ApiOperation({
    summary: '장바구니 선택 삭제 / 전체 비우기',
    description: 'ids 를 생략하면 전체를 비운다.',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(UserOneTimeTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUserCart(
    @Request() req: any,
    @Query() query: DeleteUserCartRequest,
  ): Promise<void> {
    await this.userCartService.deleteCartItems(req.user.id, query.ids);
  }
}

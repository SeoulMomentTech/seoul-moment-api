import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
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
} from '@nestjs/common';
import { ApiHeader, ApiOperation } from '@nestjs/swagger';

import {
  GetGuestCartCountResponse,
  GetGuestCartResponse,
  PatchGuestCartRequest,
  PostGuestCartRequest,
  PostGuestCartResponse,
} from './guest.cart.dto';
import { GuestCartService } from './guest.cart.service';

/** 클라이언트가 게스트 장바구니를 가리킬 때 쓰는 헤더 */
export const GUEST_ID_HEADER = 'x-guest-id';

const GUEST_CART_NOTICE = `**심사용 임시 API (게스트 장바구니)**

로그인 없이 장바구니를 담고 보는 것까지만 한다. **주문·결제로 이어지지 않는다.**

- 장바구니는 \`${GUEST_ID_HEADER}\` 헤더의 게스트 ID 로 구분한다.
- 게스트 ID 는 **담기 응답으로 처음 발급**된다. 클라이언트가 저장해 두고 이후 요청마다 헤더에 실어 보낸다.
- 회원 장바구니와 달리 라인 ID 가 없다. **수량 변경·삭제는 \`productVariantId\`** 로 한다.
- 서버에 7일만 보관되고(Redis TTL), 회원 장바구니로 옮겨주는 기능은 없다.
- 심사가 끝나면 이 모듈은 통째로 삭제한다.`;

@Controller('guest/cart')
export class GuestCartController {
  constructor(private readonly guestCartService: GuestCartService) {}

  @Post()
  @ApiOperation({
    summary: '[심사용] 게스트 장바구니 담기 (단건 · 다건)',
    description: `${GUEST_CART_NOTICE}

▶ 헤더가 없으면 새 게스트 ID 를 발급해 응답에 담아준다. 있으면 그 장바구니에 더한다. 이미 담긴 SKU 면 라인을 늘리지 않고 **수량을 더한다**. 하나라도 담을 수 없으면 전부 담지 않는다.`,
  })
  @ApiHeader({
    name: GUEST_ID_HEADER,
    required: false,
    description: '가진 게스트 ID. 처음 담을 때는 비워 보낸다',
  })
  @ResponseData(PostGuestCartResponse, HttpStatus.CREATED)
  @ResponseException(HttpStatus.NOT_FOUND, 'Product variant not found')
  @ResponseException(HttpStatus.CONFLICT, 'Not enough stock')
  async postGuestCart(
    @Headers(GUEST_ID_HEADER) guestId: string | undefined,
    @Body() body: PostGuestCartRequest,
  ): Promise<ResponseDataDto<PostGuestCartResponse>> {
    const data = await this.guestCartService.addItems(guestId, body);

    return new ResponseDataDto(data);
  }

  @Get()
  @ApiOperation({
    summary: '[심사용] 게스트 장바구니 조회',
    description: `${GUEST_CART_NOTICE}

▶ 회원 장바구니 조회와 **같은 응답 모양**이라 화면 컴포넌트를 그대로 쓸 수 있다. 라인의 \`cartItemId\` 는 항상 \`null\` 이다. 배송지를 모르므로 배송비는 본섬 기준 예상값이다.`,
  })
  @ApiHeader({
    name: GUEST_ID_HEADER,
    required: true,
    description: '담기 응답으로 받은 게스트 ID',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ResponseData(GetGuestCartResponse)
  async getGuestCart(
    @Headers(GUEST_ID_HEADER) guestId: string | undefined,
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): Promise<ResponseDataDto<GetGuestCartResponse>> {
    const data = await this.guestCartService.getCart(
      guestId ?? '',
      acceptLanguage,
    );

    return new ResponseDataDto(data);
  }

  @Get('count')
  @ApiOperation({
    summary: '[심사용] 게스트 장바구니 라인 수 (헤더 뱃지용)',
    description: `${GUEST_CART_NOTICE}

▶ 게스트 ID 가 없거나 담은 적이 없으면 \`0\` 이다. 404 를 내지 않는다.`,
  })
  @ApiHeader({
    name: GUEST_ID_HEADER,
    required: false,
    description: '가진 게스트 ID. 없으면 0 을 돌려준다',
  })
  @ResponseData(GetGuestCartCountResponse)
  async getGuestCartCount(
    @Headers(GUEST_ID_HEADER) guestId: string | undefined,
  ): Promise<ResponseDataDto<GetGuestCartCountResponse>> {
    const count = await this.guestCartService.getCount(guestId ?? '');

    return new ResponseDataDto(GetGuestCartCountResponse.from(count));
  }

  @Patch(':productVariantId(\\d+)')
  @ApiOperation({
    summary: '[심사용] 게스트 장바구니 수량 변경',
    description: `${GUEST_CART_NOTICE}

▶ 경로 파라미터는 라인 ID 가 아니라 **\`productVariantId\`** 다.`,
  })
  @ApiHeader({ name: GUEST_ID_HEADER, required: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseException(HttpStatus.NOT_FOUND, 'Guest cart item not found')
  @ResponseException(HttpStatus.CONFLICT, 'Not enough stock')
  async patchGuestCart(
    @Headers(GUEST_ID_HEADER) guestId: string | undefined,
    @Param('productVariantId', ParseIntPipe) productVariantId: number,
    @Body() body: PatchGuestCartRequest,
  ): Promise<void> {
    await this.guestCartService.updateQuantity(
      guestId ?? '',
      productVariantId,
      body.quantity,
    );
  }

  @Delete(':productVariantId(\\d+)')
  @ApiOperation({
    summary: '[심사용] 게스트 장바구니 라인 삭제',
    description: GUEST_CART_NOTICE,
  })
  @ApiHeader({ name: GUEST_ID_HEADER, required: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseException(HttpStatus.NOT_FOUND, 'Guest cart item not found')
  async deleteGuestCartItem(
    @Headers(GUEST_ID_HEADER) guestId: string | undefined,
    @Param('productVariantId', ParseIntPipe) productVariantId: number,
  ): Promise<void> {
    await this.guestCartService.deleteItem(guestId ?? '', productVariantId);
  }

  @Delete()
  @ApiOperation({
    summary: '[심사용] 게스트 장바구니 비우기',
    description: `${GUEST_CART_NOTICE}

▶ 담은 적이 없어도 204 다.`,
  })
  @ApiHeader({ name: GUEST_ID_HEADER, required: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGuestCart(
    @Headers(GUEST_ID_HEADER) guestId: string | undefined,
  ): Promise<void> {
    await this.guestCartService.clear(guestId ?? '');
  }
}

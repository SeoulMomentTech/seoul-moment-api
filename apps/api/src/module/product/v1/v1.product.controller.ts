import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation } from '@nestjs/swagger';
import { OptionalUserId } from 'apps/api/src/decorator/optional-user.decorator';
import { OptionalUserGuard } from 'apps/api/src/guard/optional-user.guard';

import { V1GetProductDetailResponse } from './v1.product.dto';
import { V1ProductService } from './v1.product.service';

@Controller('product/v1')
export class V1ProductController {
  constructor(private readonly v1ProductService: V1ProductService) {}

  @Get(':id(\\d+)')
  @ApiOperation({
    summary: 'Product detail v1 (옵션 조합·재고 포함)',
    description:
      'v0 대비 variants(옵션 조합 SKU·재고)가 추가되고 shippingCost 가 빠졌다. 배송비는 배송지로 정해지므로 GET /shipping-policy 를 쓴다.',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(OptionalUserGuard)
  @ResponseData(V1GetProductDetailResponse)
  @ResponseException(HttpStatus.NOT_FOUND, '상품이 존재하지 않습니다.')
  async getProductDetail(
    @Headers('Accept-language') acceptLanguage: LanguageCode,
    @OptionalUserId() userId: number | undefined,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<V1GetProductDetailResponse>> {
    const result = await this.v1ProductService.getProductDetail(
      id,
      acceptLanguage,
      userId,
    );

    return new ResponseDataDto(result);
  }
}

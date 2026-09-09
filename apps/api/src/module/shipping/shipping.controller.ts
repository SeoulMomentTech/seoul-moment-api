import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseDataDto } from '@app/common/type/response-data';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { GetShippingPolicyResponse } from './shipping.dto';
import { ShippingService } from './shipping.service';

@Controller('shipping-policy')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get()
  @ApiOperation({
    summary: '배송비 정책 조회',
    description:
      '상품상세·장바구니의 배송비 안내 문구가 프론트에 하드코딩되지 않도록 요율을 내려준다.',
  })
  @ResponseData(GetShippingPolicyResponse)
  async getShippingPolicy(): Promise<
    ResponseDataDto<GetShippingPolicyResponse>
  > {
    const data = await this.shippingService.getPolicy();

    return new ResponseDataDto(data);
  }
}

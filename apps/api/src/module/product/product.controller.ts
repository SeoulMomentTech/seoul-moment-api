import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { ResponseListDto } from '@app/common/type/response-list';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { GetProductBannerResponse } from './product.dto';
import { ProductService } from './product.service';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get('banner')
  @ApiOperation({
    summary: 'Product banner list',
  })
  @ResponseList(GetProductBannerResponse)
  async getProductBanner(): Promise<ResponseListDto<GetProductBannerResponse>> {
    const result = await this.productService.getProductBanner();

    return new ResponseListDto(result);
  }
}

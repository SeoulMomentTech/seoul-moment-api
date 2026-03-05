import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { ResponseListDto } from '@app/common/type/response-list';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { GetBrandPromotionResponse } from './brand-promotion.dto';
import { BrandPromotionService } from './brand-promotion.service';

@Controller('brand/promotion')
export class BrandPromotionController {
  constructor(private readonly brandPromotionService: BrandPromotionService) {}

  @Get()
  @ApiOperation({ summary: '브랜드 프로모션 리스트 조회' })
  @ResponseList(GetBrandPromotionResponse)
  async getBrandPromotionList(): Promise<
    ResponseListDto<GetBrandPromotionResponse>
  > {
    const result = await this.brandPromotionService.getBrandPromotionList();

    return new ResponseListDto(result);
  }
}

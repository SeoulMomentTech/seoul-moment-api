import { Controller, Get, Param } from '@nestjs/common';
import { BrandService } from './brand.service';
import { ApiOperation } from '@nestjs/swagger';
import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseDataDto } from '@app/common/type/response-data';
import { GetBrandIntroduceResponse } from './brand.dto';

@Controller('brand')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get('introduce/:id')
  @ApiOperation({
    summary: 'Get Brand Introduce',
  })
  @ResponseData(GetBrandIntroduceResponse)
  async getBrandIntroduce(
    @Param('id') id: number,
  ): Promise<ResponseDataDto<GetBrandIntroduceResponse>> {
    const result = await this.brandService.getBrandIntroduce(id);

    return new ResponseDataDto(result);
  }
}

import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { BrandService } from './brand.service';
import { ApiOperation } from '@nestjs/swagger';
import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseDataDto } from '@app/common/type/response-data';
import { GetBrandIntroduceResponse } from './brand.dto';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';

@Controller('brand')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get('introduce/:id')
  @ApiOperation({
    summary: 'Get Brand Introduce',
  })
  @ResponseData(GetBrandIntroduceResponse)
  @ResponseException(HttpStatus.NOT_FOUND, '존재하는 브랜드가 없음')
  async getBrandIntroduce(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetBrandIntroduceResponse>> {
    const result = await this.brandService.getBrandIntroduce(id);

    return new ResponseDataDto(result);
  }
}

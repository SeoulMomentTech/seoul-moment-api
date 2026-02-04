import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { ResponseListDto } from '@app/common/type/response-list';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { GetPlanCategoryResponse } from './plan-category.dto';
import { PlanCategoryService } from './plan-category.service';

@Controller('plen/category')
export class PlanCategoryController {
  constructor(private readonly planCategoryService: PlanCategoryService) {}

  @Get('list')
  @ApiOperation({ summary: '카테고리 목록 조회' })
  @ResponseList(GetPlanCategoryResponse)
  async getPlanCategoryList(): Promise<
    ResponseListDto<GetPlanCategoryResponse>
  > {
    const result = await this.planCategoryService.getPlanCategoryList();
    return new ResponseListDto(result);
  }
}

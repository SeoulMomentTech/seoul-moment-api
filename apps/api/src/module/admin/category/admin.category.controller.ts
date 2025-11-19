import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { ResponseListDto } from '@app/common/type/response-list';
import { Controller, Get, Query } from '@nestjs/common';

import {
  AdminCategoryListRequest,
  GetAdminCategoryListResponse,
} from './admin.category.dto';
import { AdminCategoryService } from './admin.category.service';

@Controller('admin/category')
export class AdminCategoryController {
  constructor(private readonly adminCategoryService: AdminCategoryService) {}

  @Get()
  @ResponseList(GetAdminCategoryListResponse)
  async getAdminCategoryList(
    @Query() query: AdminCategoryListRequest,
  ): Promise<ResponseListDto<GetAdminCategoryListResponse>> {
    const [result, total] =
      await this.adminCategoryService.getAdminCategoryList(query);
    return new ResponseListDto(result, total);
  }
}

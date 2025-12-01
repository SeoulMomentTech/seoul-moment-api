import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseListDto } from '@app/common/type/response-list';
import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OneTimeTokenGuard } from 'apps/api/src/guard/one-time-token.guard';

import { AdminNewsListRequest, GetAdminNewsResponse } from './admin.news.dto';
import { AdminNewsService } from './admin.news.service';

@ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
@Controller('admin/news')
@UseGuards(OneTimeTokenGuard)
@ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
export class AdminNewsController {
  constructor(private readonly adminNewsService: AdminNewsService) {}

  @Get()
  @ApiOperation({
    summary: '뉴스 리스트 조회',
  })
  @ResponseList(GetAdminNewsResponse)
  async getAdminNewsList(
    @Query() query: AdminNewsListRequest,
  ): Promise<ResponseListDto<GetAdminNewsResponse>> {
    const [result, total] = await this.adminNewsService.getAdminNewsList(query);

    return new ResponseListDto(result, total);
  }
}

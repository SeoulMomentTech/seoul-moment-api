import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseListDto } from '@app/common/type/response-list';
import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminRole } from 'apps/api/src/decorator/admin-role.decorator';
import { AdminRoleGuard } from 'apps/api/src/guard/admin-role.guard';

import { AdminUserRequest, AdminUserResponse } from './admin.user.dto';
import { AdminUserService } from './admin.user.service';

@Controller('admin/user')
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Get()
  @ApiOperation({ summary: '관리자 리스트' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @AdminRole('super_admin')
  @UseGuards(AdminRoleGuard)
  @ResponseList(AdminUserResponse)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async getAdminUserList(
    @Query() query: AdminUserRequest,
  ): Promise<ResponseListDto<AdminUserResponse>> {
    const [adminUserList, total] =
      await this.adminUserService.getAdminUserList(query);
    return new ResponseListDto(adminUserList, total);
  }
}

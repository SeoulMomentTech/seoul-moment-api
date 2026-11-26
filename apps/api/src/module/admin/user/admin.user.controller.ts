import { getTokenSubjectId } from '@app/auth/auth.token';
import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { ResponseListDto } from '@app/common/type/response-list';
import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminRole } from 'apps/api/src/decorator/admin-role.decorator';
import { AdminRoleGuard } from 'apps/api/src/guard/admin-role.guard';

import {
  AdminUserRequest,
  AdminUserResponse,
  PatchAdminUserRequest,
} from './admin.user.dto';
import { AdminUserService } from './admin.user.service';

@Controller('admin/user')
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Get()
  @ApiOperation({
    summary: '관리자 계정 목록',
    description:
      '어드민 로그인 계정(admin 테이블) 목록이다. 서울모먼트 회원은 `/admin/member` 를 쓴다.',
  })
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

  @Patch(':id(\\d+)')
  @ApiOperation({
    summary: '관리자 계정 권한 변경 (역할 · 상태)',
    description:
      'super_admin 만 된다. 보낸 필드만 바뀌고 둘 다 없으면 400. 다음 요청부터 바로 적용된다(다시 로그인할 필요 없음). ' +
      'super_admin 전용 API(환불·강제 탈퇴·권한 관리 등)는 role=super_admin 이면서 status=NORMAL 이어야 통과한다 — 가입 직후 계정은 admin · WAIT 이라 둘 다 보내야 한다. ' +
      '자기 자신은 바꿀 수 없다(409) — 다른 super_admin 이 바꿔 준다.',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @AdminRole('super_admin')
  @UseGuards(AdminRoleGuard)
  @ResponseData(AdminUserResponse)
  @ResponseException(
    HttpStatus.BAD_REQUEST,
    '변경할 항목 없음 / 없는 role·status',
  )
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  @ResponseException(HttpStatus.FORBIDDEN, 'super_admin 이 아님')
  @ResponseException(HttpStatus.NOT_FOUND, 'Admin not found')
  @ResponseException(HttpStatus.CONFLICT, '자기 자신의 권한 변경')
  async patchAdminUser(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchAdminUserRequest,
  ): Promise<ResponseDataDto<AdminUserResponse>> {
    return new ResponseDataDto(
      await this.adminUserService.update(getTokenSubjectId(req.user), id, body),
    );
  }
}

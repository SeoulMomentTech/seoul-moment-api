import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { AdminRole } from 'apps/api/src/decorator/admin-role.decorator';
import { AdminRoleGuard } from 'apps/api/src/guard/admin-role.guard';

import { AdminMemberService } from './admin.member.service';

const FORCE_WITHDRAW_DESCRIPTION = `회원을 강제로 탈퇴 처리한다. (super_admin 전용)

유저 본인 탈퇴(DELETE /user)와 동일한 처리를 수행한다.
- 이메일/닉네임/전화번호 등 식별정보는 익명값으로 치환되고 계정은 소프트 삭제된다.
- SNS 연동, 좋아요, 최근 본 상품, 프로필 이미지는 즉시 삭제된다.
- 해당 회원의 토큰은 즉시 무효화된다.
- 복구되지 않는다.`;

@Controller('admin/member')
export class AdminMemberController {
  constructor(private readonly adminMemberService: AdminMemberService) {}

  @Delete(':userId(\\d+)')
  @ApiOperation({
    summary: '회원 강제 탈퇴',
    description: FORCE_WITHDRAW_DESCRIPTION,
  })
  @ApiParam({ name: 'userId', description: '회원 ID', example: 1 })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @HttpCode(HttpStatus.ACCEPTED)
  @AdminRole('super_admin')
  @UseGuards(AdminRoleGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  @ResponseException(HttpStatus.FORBIDDEN, '권한 없음')
  @ResponseException(HttpStatus.NOT_FOUND, '유저 정보 없음 (이미 탈퇴 포함)')
  async deleteMember(@Param('userId', ParseIntPipe) userId: number) {
    await this.adminMemberService.withdrawMember(userId);
  }
}

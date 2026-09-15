import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { ResponseListDto } from '@app/common/type/response-list';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { AdminRole } from 'apps/api/src/decorator/admin-role.decorator';
import { AdminRoleGuard } from 'apps/api/src/guard/admin-role.guard';

import {
  GetAdminMemberCartResponse,
  GetAdminMemberLikeListRequest,
  GetAdminMemberLikeResponse,
  GetAdminMemberListRequest,
  GetAdminMemberListResponse,
  GetAdminMemberOrderListRequest,
  GetAdminMemberOrderListResponse,
  GetAdminMemberRecentResponse,
  GetAdminMemberResponse,
  GetAdminMemberSummaryResponse,
  PatchAdminMemberAgreementRequest,
} from './admin.member.dto';
import { AdminMemberService } from './admin.member.service';
import { ListSimpleFilterDto } from '../admin.dto';

const MEMBER_LIST_DESCRIPTION = `서울모먼트 회원 목록. (\`/admin/user\` 는 관리자 계정이라 다른 API 다)

- \`search\` 한 칸으로 이메일·닉네임·이름·전화번호를 함께 훑는다.
- \`provider=EMAIL\` 은 SNS 연동이 없는 회원이다. 가입 경로 컬럼은 따로 없다.
- \`status=WITHDRAWN\` 을 보낼 때만 탈퇴 회원을 조회한다. 기본은 활성 회원만이다.
- \`orderCount\` 는 취소·실패를 포함한 전체 건수, \`paidAmount\` 는 결제 완료 주문만 더한 금액이다.`;

const AGREEMENT_DESCRIPTION = `마케팅 수신 동의를 강제로 바꾼다. (super_admin 전용)

- DB 는 boolean 이 아니라 동의 일시다. \`true\` 를 보내면 서버가 현재 시각을 넣고 \`false\` 면 비운다.
- 보낸 필드만 바뀐다. 셋 다 비어 있으면 400 이다.
- 이용약관·개인정보 수집 동의 일시는 가입 시점의 법적 기록이라 변경할 수 없다.`;

const FORCE_WITHDRAW_DESCRIPTION = `회원을 강제로 탈퇴 처리한다. (super_admin 전용)

유저 본인 탈퇴(DELETE /user)와 동일한 처리를 수행한다.
- 이메일/닉네임/전화번호 등 식별정보는 익명값으로 치환되고 계정은 소프트 삭제된다.
- SNS 연동, 좋아요, 최근 본 상품, 프로필 이미지는 즉시 삭제된다.
- 해당 회원의 토큰은 즉시 무효화된다.
- 복구되지 않는다.`;

@Controller('admin/member')
export class AdminMemberController {
  constructor(private readonly adminMemberService: AdminMemberService) {}

  @Get()
  @ApiOperation({
    summary: '회원 목록',
    description: MEMBER_LIST_DESCRIPTION,
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(AdminRoleGuard)
  @ResponseList(GetAdminMemberListResponse)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async getMemberList(
    @Query() query: GetAdminMemberListRequest,
  ): Promise<ResponseListDto<GetAdminMemberListResponse>> {
    const [list, total] = await this.adminMemberService.getMemberList(query);

    return new ResponseListDto(list, total);
  }

  @Get('summary')
  @ApiOperation({
    summary: '회원 요약',
    description:
      '목록 상단 카드용. 목록 필터와 무관하게 항상 전체 기준으로 집계한다.',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(AdminRoleGuard)
  @ResponseData(GetAdminMemberSummaryResponse)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async getMemberSummary(): Promise<
    ResponseDataDto<GetAdminMemberSummaryResponse>
  > {
    return new ResponseDataDto(await this.adminMemberService.getSummary());
  }

  @Get(':userId(\\d+)')
  @ApiOperation({
    summary: '회원 상세',
    description:
      '계정·SNS 연동·프로필·체형·동의를 한 번에 내린다. 각 블록은 없으면 null 이다. 탈퇴 회원도 조회된다.',
  })
  @ApiParam({ name: 'userId', description: '회원 ID', example: 1042 })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(AdminRoleGuard)
  @ResponseData(GetAdminMemberResponse)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  @ResponseException(HttpStatus.NOT_FOUND, '회원 정보 없음')
  async getMember(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<ResponseDataDto<GetAdminMemberResponse>> {
    return new ResponseDataDto(await this.adminMemberService.getMember(userId));
  }

  @Patch(':userId(\\d+)/agreement')
  @ApiOperation({
    summary: '회원 수신 동의 변경',
    description: AGREEMENT_DESCRIPTION,
  })
  @ApiParam({ name: 'userId', description: '회원 ID', example: 1042 })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @AdminRole('super_admin')
  @UseGuards(AdminRoleGuard)
  @ResponseException(HttpStatus.BAD_REQUEST, '변경할 항목 없음')
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  @ResponseException(HttpStatus.FORBIDDEN, '권한 없음')
  @ResponseException(HttpStatus.NOT_FOUND, '회원 정보 없음')
  async patchMemberAgreement(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: PatchAdminMemberAgreementRequest,
  ): Promise<void> {
    await this.adminMemberService.updateAgreement(userId, body);
  }

  @Get(':userId(\\d+)/order')
  @ApiOperation({
    summary: '회원 주문 내역',
    description:
      '취소·실패 주문도 함께 내린다. 금액은 주문 시점 스냅샷이라 배송비 정책을 바꿔도 변하지 않는다.',
  })
  @ApiParam({ name: 'userId', description: '회원 ID', example: 1042 })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(AdminRoleGuard)
  @ResponseList(GetAdminMemberOrderListResponse)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  @ResponseException(HttpStatus.NOT_FOUND, '회원 정보 없음')
  async getMemberOrderList(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: GetAdminMemberOrderListRequest,
  ): Promise<ResponseListDto<GetAdminMemberOrderListResponse>> {
    const [list, total] = await this.adminMemberService.getOrderList(
      userId,
      query,
    );

    return new ResponseListDto(list, total);
  }

  @Get(':userId(\\d+)/cart')
  @ApiOperation({
    summary: '회원 장바구니',
    description:
      '페이징 없이 전부 내린다. 담은 뒤 상품이 내려갔으면 isAvailable 이 false 다.',
  })
  @ApiParam({ name: 'userId', description: '회원 ID', example: 1042 })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(AdminRoleGuard)
  @ResponseList(GetAdminMemberCartResponse)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  @ResponseException(HttpStatus.NOT_FOUND, '회원 정보 없음')
  async getMemberCart(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<ResponseListDto<GetAdminMemberCartResponse>> {
    const list = await this.adminMemberService.getCart(userId);

    return new ResponseListDto(list, list.length);
  }

  @Get(':userId(\\d+)/like')
  @ApiOperation({
    summary: '회원 좋아요',
    description:
      'type 을 생략하면 상품·브랜드를 섞어 최신순으로 내린다. targetId 는 type 에 따라 참조가 다르다.',
  })
  @ApiParam({ name: 'userId', description: '회원 ID', example: 1042 })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(AdminRoleGuard)
  @ResponseList(GetAdminMemberLikeResponse)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  @ResponseException(HttpStatus.NOT_FOUND, '회원 정보 없음')
  async getMemberLikeList(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: GetAdminMemberLikeListRequest,
  ): Promise<ResponseListDto<GetAdminMemberLikeResponse>> {
    const [list, total] = await this.adminMemberService.getLikeList(
      userId,
      query,
    );

    return new ResponseListDto(list, total);
  }

  @Get(':userId(\\d+)/recent')
  @ApiOperation({
    summary: '회원 최근 본 상품',
    description:
      '마지막으로 본 순서. user_recent 는 보관 개수가 제한돼 있어 "평생 본 목록"이 아니다.',
  })
  @ApiParam({ name: 'userId', description: '회원 ID', example: 1042 })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(AdminRoleGuard)
  @ResponseList(GetAdminMemberRecentResponse)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  @ResponseException(HttpStatus.NOT_FOUND, '회원 정보 없음')
  async getMemberRecentList(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: ListSimpleFilterDto,
  ): Promise<ResponseListDto<GetAdminMemberRecentResponse>> {
    const [list, total] = await this.adminMemberService.getRecentList(
      userId,
      query,
    );

    return new ResponseListDto(list, total);
  }

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

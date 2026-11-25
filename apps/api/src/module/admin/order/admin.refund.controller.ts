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
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminRole } from 'apps/api/src/decorator/admin-role.decorator';
import { AdminRoleGuard } from 'apps/api/src/guard/admin-role.guard';

import {
  GetAdminInvoiceAdjustmentResponse,
  GetAdminRefundListItemResponse,
  GetAdminRefundListRequest,
  GetAdminRefundResponse,
  PostAdminOrderRefundCompleteRequest,
  PostAdminOrderRefundRequest,
} from './admin.refund.dto';
import { AdminRefundService } from './admin.refund.service';
import { RefundService } from '../../refund/refund.service';

@ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
@Controller('admin')
@UseGuards(AdminRoleGuard)
@ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료 / 관리자 토큰 아님')
export class AdminRefundController {
  constructor(
    private readonly refundService: RefundService,
    private readonly adminRefundService: AdminRefundService,
  ) {}

  @Post('order/:id(\\d+)/refund')
  @AdminRole('super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '환불 실행 (전액) · 재시도',
    description:
      'super_admin 만 된다. 결제 완료(PAID)·결제 후 처리 실패(FAILED) 주문의 결제 금액 전부를 돌려준다. 고객의 취소 신청이 없어도 실행할 수 있다. ' +
      'LINE Pay 는 환불 API 를 불러 결과가 바로 status 에 온다 (COMPLETED / FAILED=LINE Pay 가 환불하지 않았다고 확정 / PROCESSING=결과 미확인). ' +
      'ECPay(카드·ATM·편의점)는 API 를 부르지 않고 REQUESTED·isManual=true 로 기록만 한다 — ECPay 후台이나 계좌 송금으로 돌려준 뒤 /refund/complete 를 부른다. ' +
      'FAILED·PROCESSING 인 주문에 다시 부르면 재시도이고, 이미 나간 환불이 있는지 LINE Pay 에 먼저 조회해서 두 번 돌려주지 않는다. ' +
      'COMPLETED 가 되면 주문은 CANCELED 로 바뀌고 전자발표 정정이 따로 시작된다.',
  })
  @ResponseData(GetAdminRefundResponse)
  @ResponseException(HttpStatus.NOT_FOUND, 'Order not found')
  @ResponseException(HttpStatus.FORBIDDEN, 'super_admin 이 아님')
  @ResponseException(
    HttpStatus.CONFLICT,
    '이미 환불 완료 / 결제된 주문이 아님 / 결제가 둘 이상(중복 결제) / 같은 주문의 환불이 진행 중',
  )
  async postAdminOrderRefund(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PostAdminOrderRefundRequest,
  ): Promise<ResponseDataDto<GetAdminRefundResponse>> {
    const refund = await this.refundService.request(
      getTokenSubjectId(req.user),
      id,
      body.reason,
    );

    return new ResponseDataDto(GetAdminRefundResponse.from(refund));
  }

  @Post('order/:id(\\d+)/refund/complete')
  @AdminRole('super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '수동 환불 완료 입력',
    description:
      'super_admin 만 된다. PG 밖에서 실제로 돈을 돌려준 뒤에 부른다 — 이 API 는 돈을 보내지 않고 완료만 기록한다. ' +
      '수동 환불(isManual=true)이거나 LINE Pay 가 거절한(FAILED) 환불에만 된다. 결과 미확인(PROCESSING)인 LINE Pay 환불은 409 — /refund 로 다시 시도해 결과부터 확인한다. ' +
      'LINE Pay 조회가 계속 실패해 PROCESSING 에서 못 벗어나면 LINE Pay 가맹점 화면에서 환불 여부를 확인한 뒤 개발팀이 상태를 고쳐야 한다.',
  })
  @ResponseData(GetAdminRefundResponse)
  @ResponseException(HttpStatus.NOT_FOUND, 'Order not found')
  @ResponseException(HttpStatus.FORBIDDEN, 'super_admin 이 아님')
  @ResponseException(
    HttpStatus.CONFLICT,
    '시작한 환불이 없음 / 이미 완료 / PG 가 처리 중인 환불',
  )
  async postAdminOrderRefundComplete(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PostAdminOrderRefundCompleteRequest,
  ): Promise<ResponseDataDto<GetAdminRefundResponse>> {
    const refund = await this.refundService.completeManually(
      getTokenSubjectId(req.user),
      id,
      body.reference,
    );

    return new ResponseDataDto(GetAdminRefundResponse.from(refund));
  }

  @Post('order/:id(\\d+)/invoice-adjust')
  @AdminRole('super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '전자발표 정정 재시도 (作廢·折讓)',
    description:
      'super_admin 만 된다. 환불이 끝난 주문의 발표 정정만 다시 시도한다. 환불은 다시 하지 않는다. 신고 기한(발표 기간 다음 홀수 달 13일) 안이면 作廢, 지났으면 전액 折讓 이다. ' +
      '정정은 환불 완료 직후와 5분 배치(5회까지)가 자동으로 시도하므로, 이 API 는 adjustStatus 가 FAILED·PENDING 으로 남았을 때 쓴다.',
  })
  @ResponseData(GetAdminInvoiceAdjustmentResponse)
  @ResponseException(HttpStatus.NOT_FOUND, '발표가 없는 주문')
  @ResponseException(HttpStatus.FORBIDDEN, 'super_admin 이 아님')
  @ResponseException(
    HttpStatus.CONFLICT,
    '정정할 것이 없음 (환불 전·이미 정정됨) / 발행·정정이 진행 중',
  )
  async postAdminOrderInvoiceAdjust(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetAdminInvoiceAdjustmentResponse>> {
    return new ResponseDataDto(
      await this.adminRefundService.retryInvoiceAdjust(id),
    );
  }

  @Get('refund')
  @ApiOperation({
    summary: '취소/환불 관리 목록',
    description:
      '시작된 환불을 최근순으로. 환불(PG) 상태와 전자발표 정정 상태가 따로 내려간다 — 둘이 어긋난 건(환불 COMPLETED + 정정 FAILED)을 여기서 찾는다. ' +
      '아직 환불을 시작하지 않은 취소 신청은 GET /admin/order?chip=CANCEL_REQUESTED 에 있다.',
  })
  @ResponseList(GetAdminRefundListItemResponse)
  async getAdminRefundList(
    @Query() query: GetAdminRefundListRequest,
  ): Promise<ResponseListDto<GetAdminRefundListItemResponse>> {
    const [list, total] = await this.adminRefundService.getList(query);

    return new ResponseListDto(list, total);
  }
}

import { getTokenSubjectId } from '@app/auth/auth.token';
import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { ResponseListDto } from '@app/common/type/response-list';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation } from '@nestjs/swagger';
import { AdminRoleGuard } from 'apps/api/src/guard/admin-role.guard';

import {
  GetAdminOrderDetailResponse,
  GetAdminOrderListItemResponse,
  GetAdminOrderListRequest,
  GetAdminOrderSummaryResponse,
  PostAdminOrderPurchaseRequest,
} from './admin.order.dto';
import { AdminOrderService } from './admin.order.service';

const LANGUAGE_HEADER = {
  name: 'Accept-language',
  required: false,
  description: '상태 문구 언어 (ko, en, zh-TW). 생략하면 ko',
  enum: LanguageCode,
};

@ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
@Controller('admin/order')
@UseGuards(AdminRoleGuard)
@ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료 / 관리자 토큰 아님')
export class AdminOrderController {
  constructor(private readonly adminOrderService: AdminOrderService) {}

  @Get('summary')
  @ApiOperation({
    summary: '주문 및 발주 관리 KPI 4개',
    description:
      '오늘 신규(Asia/Taipei 당일 결제 완료) / 24시간 대기 중 / 발주 가능 / 취소 요청. 서로 겹칠 수 있어 합산하지 않는다.',
  })
  @ResponseData(GetAdminOrderSummaryResponse)
  async getAdminOrderSummary(): Promise<
    ResponseDataDto<GetAdminOrderSummaryResponse>
  > {
    return new ResponseDataDto(await this.adminOrderService.getSummary());
  }

  @Get()
  @ApiOperation({
    summary: '주문 및 발주 관리 목록',
    description:
      '결제 완료·입금 대기 주문. chip 으로 KPI 와 같은 필터를 건다. 남은 시간·발주 가능 여부는 서버 시각 기준이라 클라이언트 시계를 바꿔도 달라지지 않는다.',
  })
  @ApiHeader(LANGUAGE_HEADER)
  @ResponseList(GetAdminOrderListItemResponse)
  async getAdminOrderList(
    @Query() query: GetAdminOrderListRequest,
    @Headers('Accept-language') language: LanguageCode,
  ): Promise<ResponseListDto<GetAdminOrderListItemResponse>> {
    const [list, total] = await this.adminOrderService.getList(query, language);

    return new ResponseListDto(list, total);
  }

  @Get(':id(\\d+)')
  @ApiOperation({
    summary: '주문 상세 (우측 드로어)',
    description:
      '고객 주문 상세 + 발주·매입 + 24시간 타이머. 통관·배송, 취소·환불, 작업 이력 탭은 아직 데이터가 없다.',
  })
  @ApiHeader(LANGUAGE_HEADER)
  @ResponseData(GetAdminOrderDetailResponse)
  @ResponseException(HttpStatus.NOT_FOUND, 'Order not found')
  async getAdminOrder(
    @Param('id', ParseIntPipe) id: number,
    @Headers('Accept-language') language: LanguageCode,
  ): Promise<ResponseDataDto<GetAdminOrderDetailResponse>> {
    return new ResponseDataDto(
      await this.adminOrderService.getDetail(id, language),
    );
  }

  @Post(':id(\\d+)/purchase')
  @ApiOperation({
    summary: '한국 발주 시작',
    description:
      '24시간 경과(timerState=READY)면 바로 처리한다. 그 전이면 earlyReason(사유)이 있어야 하며 조기 발주로 기록된다. ' +
      '취소·계약해제가 접수됐거나 이미 발주한 주문은 409. 공급처에 자동 주문이 나가지는 않는다 — supplierOrderNo 는 관리자가 입력한다. ' +
      '성공하면 배송 단계가 PREPARING_ORDER(상품 준비 중)로 바뀐다. 해외배송 시작과는 별개다.',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseException(HttpStatus.NOT_FOUND, 'Order not found')
  @ResponseException(
    HttpStatus.CONFLICT,
    '이미 발주 / 취소 접수 / 결제 미완료 / 그 사이 상태가 바뀜',
  )
  @ResponseException(
    HttpStatus.BAD_REQUEST,
    '24시간 전 조기 발주인데 earlyReason 없음',
  )
  async postAdminOrderPurchase(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PostAdminOrderPurchaseRequest,
  ): Promise<void> {
    await this.adminOrderService.startPurchase(
      getTokenSubjectId(req.user),
      id,
      body,
    );
  }
}

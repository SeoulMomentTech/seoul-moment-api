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
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation } from '@nestjs/swagger';
import { AdminRoleGuard } from 'apps/api/src/guard/admin-role.guard';

import {
  GetAdminShipmentListRequest,
  GetAdminShipmentResponse,
  PatchAdminShipmentRequest,
  PostAdminShipmentRequest,
  PostAdminShipmentResponse,
} from './admin.shipment.dto';
import { AdminShipmentService } from './admin.shipment.service';

const LANGUAGE_HEADER = {
  name: 'Accept-language',
  required: false,
  description: '배송 단계 문구 언어 (ko, en, zh-TW). 생략하면 ko',
  enum: LanguageCode,
};

@ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
@Controller('admin/shipment')
@UseGuards(AdminRoleGuard)
@ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료 / 관리자 토큰 아님')
export class AdminShipmentController {
  constructor(private readonly adminShipmentService: AdminShipmentService) {}

  @Post()
  @ApiOperation({
    summary: '통관·물류 등록 (국제배송 묶음)',
    description:
      '국제배송 박스 1개를 등록하고 실린 주문을 잇는다. 여러 주문을 한 묶음에 넣을 수 있다. ' +
      '국제운송장 번호와 수입신고번호는 다른 번호라 같은 값이면 400. 다른 묶음과 번호가 겹치면 저장은 되고 응답의 same…ShipmentIds 로 알려 준다. ' +
      '통관 상태를 넣어도 주문의 배송 단계는 바뀌지 않는다 — 단계는 POST /admin/order/delivery-stage 로 따로 바꾼다.',
  })
  @ResponseData(PostAdminShipmentResponse, HttpStatus.CREATED)
  @ResponseException(HttpStatus.CONFLICT, '없는 주문 / 결제 완료가 아닌 주문')
  @ResponseException(
    HttpStatus.BAD_REQUEST,
    '운송장 번호와 수입신고번호가 같음',
  )
  async postAdminShipment(
    @Request() req: any,
    @Body() body: PostAdminShipmentRequest,
  ): Promise<ResponseDataDto<PostAdminShipmentResponse>> {
    return new ResponseDataDto(
      await this.adminShipmentService.create(getTokenSubjectId(req.user), body),
    );
  }

  @Patch(':id(\\d+)')
  @ApiOperation({
    summary: '통관·물류 수정',
    description:
      '보낸 필드만 고친다. 글자 필드는 빈 문자열이나 null, 날짜 필드는 null 을 보내면 그 값을 지운다. orderIds 를 보내면 실린 주문을 통째로 바꾼다. ' +
      '고칠 때마다 실린 주문의 작업 이력에 한 줄이 쌓인다.',
  })
  @ResponseData(PostAdminShipmentResponse)
  @ResponseException(HttpStatus.NOT_FOUND, 'Shipment not found')
  @ResponseException(
    HttpStatus.CONFLICT,
    '새로 넣은 주문이 없거나 결제 완료가 아님',
  )
  @ResponseException(
    HttpStatus.BAD_REQUEST,
    '운송장 번호와 수입신고번호가 같음',
  )
  async patchAdminShipment(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchAdminShipmentRequest,
  ): Promise<ResponseDataDto<PostAdminShipmentResponse>> {
    return new ResponseDataDto(
      await this.adminShipmentService.update(
        getTokenSubjectId(req.user),
        id,
        body,
      ),
    );
  }

  @Get()
  @ApiOperation({
    summary: '통관·물류 목록',
    description:
      'search 는 국제운송장·분할운송장·수입신고번호·주문번호·대만 운송장을 한 번에 찾는다. 최근 등록순.',
  })
  @ApiHeader(LANGUAGE_HEADER)
  @ResponseList(GetAdminShipmentResponse)
  async getAdminShipmentList(
    @Query() query: GetAdminShipmentListRequest,
    @Headers('Accept-language') language: LanguageCode,
  ): Promise<ResponseListDto<GetAdminShipmentResponse>> {
    const [list, total] = await this.adminShipmentService.getList(
      query,
      language,
    );

    return new ResponseListDto(list, total);
  }

  @Get(':id(\\d+)')
  @ApiOperation({ summary: '통관·물류 상세' })
  @ApiHeader(LANGUAGE_HEADER)
  @ResponseData(GetAdminShipmentResponse)
  @ResponseException(HttpStatus.NOT_FOUND, 'Shipment not found')
  async getAdminShipment(
    @Param('id', ParseIntPipe) id: number,
    @Headers('Accept-language') language: LanguageCode,
  ): Promise<ResponseDataDto<GetAdminShipmentResponse>> {
    return new ResponseDataDto(
      await this.adminShipmentService.getDetail(id, language),
    );
  }
}

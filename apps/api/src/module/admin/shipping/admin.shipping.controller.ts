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
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminRoleGuard } from 'apps/api/src/guard/admin-role.guard';

import {
  GetAdminShippingPolicyResponse,
  GetAdminShippingRemoteAreaResponse,
  PatchAdminShippingPolicyRequest,
  PostAdminShippingRemoteAreaRequest,
} from './admin.shipping.dto';
import { AdminShippingService } from './admin.shipping.service';

@Controller('admin/shipping')
export class AdminShippingController {
  constructor(private readonly adminShippingService: AdminShippingService) {}

  @Get('policy')
  @ApiOperation({ summary: '배송비 정책 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(AdminRoleGuard)
  @ResponseData(GetAdminShippingPolicyResponse)
  async getAdminShippingPolicy(): Promise<
    ResponseDataDto<GetAdminShippingPolicyResponse>
  > {
    const data = await this.adminShippingService.getPolicy();

    return new ResponseDataDto(data);
  }

  @Patch('policy')
  @ApiOperation({
    summary: '배송비 정책 수정',
    description:
      '이미 생성된 주문의 금액은 스냅샷으로 고정되어 있어 이 값을 바꿔도 변하지 않는다.',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(AdminRoleGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseException(HttpStatus.BAD_REQUEST, 'Bad request')
  async patchAdminShippingPolicy(
    @Body() body: PatchAdminShippingPolicyRequest,
  ): Promise<void> {
    await this.adminShippingService.updatePolicy(body);
  }

  @Get('remote-area')
  @ApiOperation({ summary: '외섬 지역 목록 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(AdminRoleGuard)
  @ResponseList(GetAdminShippingRemoteAreaResponse)
  async getAdminShippingRemoteAreaList(): Promise<
    ResponseListDto<GetAdminShippingRemoteAreaResponse>
  > {
    const list = await this.adminShippingService.getRemoteAreaList();

    return new ResponseListDto(list, list.length);
  }

  @Post('remote-area')
  @ApiOperation({
    summary: '외섬 지역 추가',
    description:
      'district 를 생략하면 해당 縣 전체가 외섬이 된다. 綠島鄉·蘭嶼鄉 처럼 縣 일부만 외섬일 때는 district 를 지정한다.',
  })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(AdminRoleGuard)
  @HttpCode(HttpStatus.CREATED)
  @ResponseException(HttpStatus.CONFLICT, 'Already registered remote area')
  async postAdminShippingRemoteArea(
    @Body() body: PostAdminShippingRemoteAreaRequest,
  ): Promise<void> {
    await this.adminShippingService.createRemoteArea(body);
  }

  @Delete('remote-area/:id(\\d+)')
  @ApiOperation({ summary: '외섬 지역 삭제' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(AdminRoleGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseException(HttpStatus.NOT_FOUND, 'Remote area not found')
  async deleteAdminShippingRemoteArea(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.adminShippingService.deleteRemoteArea(id);
  }
}

import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
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
  Query,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import {
  GetAdminProductOptionInfoResponse,
  GetAdminProductOptionRequest,
  GetAdminProductOptionResponse,
  PatchAdminProductOptionRequest,
  PatchAdminProductOptionValueRequest,
  PostAdminProductOptionRequest,
  PostAdminProductOptionValueRequest,
} from './admin.product.option.dto';
import { AdminProductOptionService } from './admin.product.option.service';

@Controller('admin/product/option')
export class AdminProductOptionController {
  constructor(
    private readonly adminProductOptionService: AdminProductOptionService,
  ) {}

  @Get()
  @ApiOperation({ summary: '상품 옵션 목록 조회' })
  @ResponseList(GetAdminProductOptionResponse)
  async getAdminProductOptionList(
    @Query() query: GetAdminProductOptionRequest,
  ): Promise<ResponseListDto<GetAdminProductOptionResponse>> {
    const [optionList, total] =
      await this.adminProductOptionService.getAdminProductOptionList(query);

    return new ResponseListDto(optionList, total);
  }

  @Post()
  @ApiOperation({ summary: '상품 옵션 등록' })
  @HttpCode(HttpStatus.CREATED)
  async postAdminProductOption(@Body() body: PostAdminProductOptionRequest) {
    await this.adminProductOptionService.postAdminProductOption(body);
  }

  @Post('value')
  @ApiOperation({ summary: '상품 옵션 값 등록' })
  @HttpCode(HttpStatus.CREATED)
  async postAdminProductOptionValue(
    @Body() body: PostAdminProductOptionValueRequest,
  ) {
    await this.adminProductOptionService.postAdminProductOptionValue(body);
  }

  @Patch('value/:id(\\d+)')
  @ApiOperation({ summary: '상품 옵션 값 수정' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async patchAdminProductOptionValue(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchAdminProductOptionValueRequest,
  ) {
    await this.adminProductOptionService.patchAdminProductOptionValue(id, body);
  }

  @Delete('value/:id(\\d+)')
  @ApiOperation({ summary: '상품 옵션 값 삭제' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAdminProductOptionValue(@Param('id', ParseIntPipe) id: number) {
    await this.adminProductOptionService.deleteAdminProductOptionValue(id);
  }

  @Delete(':id(\\d+)')
  @ApiOperation({ summary: '상품 옵션 삭제' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAdminProductOption(@Param('id', ParseIntPipe) id: number) {
    await this.adminProductOptionService.deleteAdminProductOption(id);
  }

  @Patch(':id(\\d+)')
  @ApiOperation({ summary: '상품 옵션 수정' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async patchAdminProductOption(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchAdminProductOptionRequest,
  ) {
    await this.adminProductOptionService.patchAdminProductOption(id, body);
  }

  @Get(':id(\\d+)')
  @ApiOperation({ summary: '상품 옵션 상세 조회' })
  @ResponseData(GetAdminProductOptionInfoResponse)
  async getAdminProductOptionInfo(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetAdminProductOptionInfoResponse>> {
    const data =
      await this.adminProductOptionService.getAdminProductOptionInfo(id);

    return new ResponseDataDto(data);
  }
}

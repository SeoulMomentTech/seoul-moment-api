import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { PagingDto } from '@app/common/dto/global.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { ResponseListDto } from '@app/common/type/response-list';
import { ProductSortDto } from '@app/repository/dto/product.dto';
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
  GetAdminProductRequest,
  GetAdminProductResponse,
  PatchAdminProductRequest,
  PostAdminProductRequest,
  GetAdminProductDetailResponse,
} from './admin.product.dto';
import { AdminProductService } from './admin.product.service';

@Controller('admin/product')
export class AdminProductController {
  constructor(private readonly adminProductService: AdminProductService) {}

  @Get()
  @ApiOperation({ summary: '대주제 상품 리스트' })
  @ResponseList(GetAdminProductResponse)
  async getAdminProductList(
    @Query() query: GetAdminProductRequest,
  ): Promise<ResponseListDto<GetAdminProductResponse>> {
    const [productList, total] =
      await this.adminProductService.getAdminProductList(
        PagingDto.from(query.page, query.count),
        ProductSortDto.from(query.sortColumn, query.sort),
      );

    return new ResponseListDto(productList, total);
  }

  @Post()
  @ApiOperation({
    summary: `
      상품 대주제 등록 
      ex) 나이키 아이다스 저지, 나이키 에어포스 등등
    `,
    description: `
      이 등록은 실제 상품 LIST 에 나오는 것이 아닌 상품 대주제를 등록하는 것입니다.
      ex) 나이키 아이다스 저지, 나이키 에어포스 등등
    `,
  })
  @HttpCode(HttpStatus.CREATED)
  async postAdminProduct(@Body() body: PostAdminProductRequest) {
    await this.adminProductService.postAdminProduct(body);
  }

  @Delete(':id(\\d+)')
  @ApiOperation({
    summary: '상품 대주제 삭제',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAdminProduct(@Param('id', ParseIntPipe) id: number) {
    await this.adminProductService.deleteAdminProduct(id);
  }

  @Patch(':id(\\d+)')
  @ApiOperation({
    summary: '상품 대주제 수정',
  })
  @HttpCode(HttpStatus.OK)
  async patchAdminProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchAdminProductRequest,
  ) {
    await this.adminProductService.patchAdminProduct(id, body);
  }

  @Get(':id(\\d+)')
  @ApiOperation({
    summary: '상품 대주제 상세 조회',
  })
  @ResponseData(GetAdminProductDetailResponse)
  async getAdminProductDetail(@Param('id', ParseIntPipe) id: number) {
    const result = await this.adminProductService.getAdminProductDetail(id);
    return new ResponseDataDto(result);
  }
}

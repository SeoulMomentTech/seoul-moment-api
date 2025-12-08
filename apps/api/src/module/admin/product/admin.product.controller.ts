import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { PagingDto } from '@app/common/dto/global.dto';
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

  @Delete(':id')
  @ApiOperation({
    summary: '상품 대주제 삭제',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAdminProduct(@Param('id') id: number) {
    await this.adminProductService.deleteAdminProduct(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '상품 대주제 수정',
  })
  @HttpCode(HttpStatus.OK)
  async patchAdminProduct(
    @Param('id') id: number,
    @Body() body: PatchAdminProductRequest,
  ) {
    await this.adminProductService.patchAdminProduct(id, body);
  }
}

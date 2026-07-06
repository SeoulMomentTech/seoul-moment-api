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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OneTimeTokenGuard } from 'apps/api/src/guard/one-time-token.guard';

import {
  AdminNewsListRequest,
  GetAdminNewsCategoryResponse,
  GetAdminNewsHashtagResponse,
  GetAdminNewsInfoResponse,
  GetAdminNewsResponse,
  PostAdminNewsCategoryRequest,
  PostAdminNewsHashtagRequest,
  PostAdminNewsRequest,
  PostAdminNewsTaxonomyResponse,
  UpdateAdminNewsCategoryRequest,
  UpdateAdminNewsHashtagRequest,
  UpdateAdminNewsRequest,
  V2UpdateAdminNewsRequest,
} from './admin.news.dto';
import { AdminNewsService } from './admin.news.service';

@ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
@Controller('admin/news')
@UseGuards(OneTimeTokenGuard)
@ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
export class AdminNewsController {
  constructor(private readonly adminNewsService: AdminNewsService) {}

  @Get()
  @ApiOperation({
    summary: '뉴스 리스트 조회',
  })
  @ResponseList(GetAdminNewsResponse)
  async getAdminNewsList(
    @Query() query: AdminNewsListRequest,
  ): Promise<ResponseListDto<GetAdminNewsResponse>> {
    const [result, total] = await this.adminNewsService.getAdminNewsList(query);

    return new ResponseListDto(result, total);
  }

  @Get(':id(\\d+)')
  @ApiOperation({
    summary: '뉴스 다국어 조회',
    deprecated: true,
  })
  @ResponseData(GetAdminNewsInfoResponse)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async getAdminNewsInfo(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetAdminNewsInfoResponse>> {
    const result = await this.adminNewsService.getAdminNewsInfo(id);
    return new ResponseDataDto(result);
  }

  @Post()
  @ApiOperation({
    summary: '뉴스 데이터 입력',
    deprecated: true,
  })
  @HttpCode(HttpStatus.CREATED)
  async postNews(@Body() body: PostAdminNewsRequest) {
    await this.adminNewsService.postAdminNews(body);
  }

  @Patch(':id(\\d+)')
  @ApiOperation({
    summary: '뉴스 수정',
    deprecated: true,
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async updateAdminNews(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAdminNewsRequest,
  ) {
    await this.adminNewsService.updateAdminNews(id, body);
  }

  @Patch('v2/:id(\\d+)')
  @ApiOperation({
    summary: '뉴스 수정 (V2)',
    deprecated: true,
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async V2UpdateAdminNews(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: V2UpdateAdminNewsRequest,
  ) {
    await this.adminNewsService.V2UpdateAdminNews(id, body);
  }

  @Delete(':id(\\d+)')
  @ApiOperation({
    summary: '뉴스 삭제',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(OneTimeTokenGuard)
  @ResponseException(HttpStatus.UNAUTHORIZED, '토큰 만료')
  async deleteAdminNews(@Param('id', ParseIntPipe) id: number) {
    await this.adminNewsService.deleteAdminNews(id);
  }

  // ── News Category CRUD ──

  @Get('category')
  @ApiOperation({
    summary: '뉴스 카테고리 리스트 조회',
  })
  @ResponseList(GetAdminNewsCategoryResponse)
  async getAdminNewsCategoryList(): Promise<
    ResponseListDto<GetAdminNewsCategoryResponse>
  > {
    const result = await this.adminNewsService.getAdminNewsCategoryList();
    return new ResponseListDto(result);
  }

  @Post('category')
  @ApiOperation({
    summary: '뉴스 카테고리 생성',
  })
  @HttpCode(HttpStatus.CREATED)
  @ResponseData(PostAdminNewsTaxonomyResponse)
  async postAdminNewsCategory(
    @Body() body: PostAdminNewsCategoryRequest,
  ): Promise<ResponseDataDto<PostAdminNewsTaxonomyResponse>> {
    const id = await this.adminNewsService.postAdminNewsCategory(body);
    return new ResponseDataDto(PostAdminNewsTaxonomyResponse.from(id));
  }

  @Get('category/:id(\\d+)')
  @ApiOperation({
    summary: '뉴스 카테고리 다국어 조회',
  })
  @ResponseData(GetAdminNewsCategoryResponse)
  @ResponseException(HttpStatus.NOT_FOUND, '뉴스 카테고리 없음')
  async getAdminNewsCategoryInfo(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetAdminNewsCategoryResponse>> {
    const result = await this.adminNewsService.getAdminNewsCategoryInfo(id);
    return new ResponseDataDto(result);
  }

  @Patch('category/:id(\\d+)')
  @ApiOperation({
    summary: '뉴스 카테고리 다국어 수정',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @ResponseException(HttpStatus.NOT_FOUND, '뉴스 카테고리 없음')
  async updateAdminNewsCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAdminNewsCategoryRequest,
  ) {
    await this.adminNewsService.updateAdminNewsCategory(id, body);
  }

  @Delete('category/:id(\\d+)')
  @ApiOperation({
    summary: '뉴스 카테고리 삭제',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @ResponseException(HttpStatus.NOT_FOUND, '뉴스 카테고리 없음')
  async deleteAdminNewsCategory(@Param('id', ParseIntPipe) id: number) {
    await this.adminNewsService.deleteAdminNewsCategory(id);
  }

  // ── News Hashtag CRUD ──

  @Get('hashtag')
  @ApiOperation({
    summary: '뉴스 해시태그 리스트 조회',
  })
  @ResponseList(GetAdminNewsHashtagResponse)
  async getAdminNewsHashtagList(): Promise<
    ResponseListDto<GetAdminNewsHashtagResponse>
  > {
    const result = await this.adminNewsService.getAdminNewsHashtagList();
    return new ResponseListDto(result);
  }

  @Post('hashtag')
  @ApiOperation({
    summary: '뉴스 해시태그 생성',
  })
  @HttpCode(HttpStatus.CREATED)
  @ResponseData(PostAdminNewsTaxonomyResponse)
  async postAdminNewsHashtag(
    @Body() body: PostAdminNewsHashtagRequest,
  ): Promise<ResponseDataDto<PostAdminNewsTaxonomyResponse>> {
    const id = await this.adminNewsService.postAdminNewsHashtag(body);
    return new ResponseDataDto(PostAdminNewsTaxonomyResponse.from(id));
  }

  @Get('hashtag/:id(\\d+)')
  @ApiOperation({
    summary: '뉴스 해시태그 다국어 조회',
  })
  @ResponseData(GetAdminNewsHashtagResponse)
  @ResponseException(HttpStatus.NOT_FOUND, '뉴스 해시태그 없음')
  async getAdminNewsHashtagInfo(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDataDto<GetAdminNewsHashtagResponse>> {
    const result = await this.adminNewsService.getAdminNewsHashtagInfo(id);
    return new ResponseDataDto(result);
  }

  @Patch('hashtag/:id(\\d+)')
  @ApiOperation({
    summary: '뉴스 해시태그 다국어 수정',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @ResponseException(HttpStatus.NOT_FOUND, '뉴스 해시태그 없음')
  async updateAdminNewsHashtag(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAdminNewsHashtagRequest,
  ) {
    await this.adminNewsService.updateAdminNewsHashtag(id, body);
  }

  @Delete('hashtag/:id(\\d+)')
  @ApiOperation({
    summary: '뉴스 해시태그 삭제',
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @ResponseException(HttpStatus.NOT_FOUND, '뉴스 해시태그 없음')
  async deleteAdminNewsHashtag(@Param('id', ParseIntPipe) id: number) {
    await this.adminNewsService.deleteAdminNewsHashtag(id);
  }
}

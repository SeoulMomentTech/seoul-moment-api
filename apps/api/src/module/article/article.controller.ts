import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
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
} from '@nestjs/common';
import { ApiHeader, ApiOperation } from '@nestjs/swagger';

import {
  GetArticleListRequest,
  GetArticleListResponse,
  GetArticleResponse,
  PostArticleRequest,
} from './article.dto';
import { ArticleService } from './article.service';

@Controller('article')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Get('list')
  @ApiOperation({
    summary: 'Get Article list with Multilingual Support',
    description:
      'Returns Article list in the specified language. Supports Korean (ko), English (en), and Chinese (zh).',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ResponseList(GetArticleListResponse)
  @ResponseException(HttpStatus.NOT_FOUND, '존재하는 뉴스가 없음')
  async getNewsList(
    @Query() query: GetArticleListRequest,
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): Promise<ResponseListDto<GetArticleListResponse>> {
    const result = await this.articleService.getArticleList(
      query.count,
      acceptLanguage,
    );

    return new ResponseListDto(result);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get article with Multilingual Support',
    description:
      'Returns article in the specified language. Supports Korean (ko), English (en), and Chinese (zh).',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ResponseData(GetArticleResponse)
  @ResponseException(HttpStatus.NOT_FOUND, '존재하는 아티클이 없음')
  async getArticle(
    @Param('id', ParseIntPipe) id: number,
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): Promise<ResponseDataDto<GetArticleResponse>> {
    const result = await this.articleService.getArticle(id, acceptLanguage);

    return new ResponseDataDto(result);
  }

  @Post()
  @ApiOperation({
    summary: '아티클 데이터 입력',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async postArticle(@Body() body: PostArticleRequest) {
    await this.articleService.postArticle(body);
  }
}

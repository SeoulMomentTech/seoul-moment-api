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
  GetNewsListRequest,
  GetNewsListResponse,
  GetNewsResponse,
  PostNewsRequest,
} from './news.dto';
import { NewsService } from './news.service';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get('list')
  @ApiOperation({
    summary: 'Get News list with Multilingual Support',
    description:
      'Returns news list in the specified language. Supports Korean (ko), English (en), and Chinese (zh).',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ResponseList(GetNewsListResponse)
  @ResponseException(HttpStatus.NOT_FOUND, '존재하는 뉴스가 없음')
  async getNewsList(
    @Query() query: GetNewsListRequest,
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): Promise<ResponseListDto<GetNewsListResponse>> {
    const result = await this.newsService.getNewsList(
      query.count,
      acceptLanguage,
    );

    return new ResponseListDto(result);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get News with Multilingual Support',
    description:
      'Returns news in the specified language. Supports Korean (ko), English (en), and Chinese (zh).',
  })
  @ApiHeader({
    name: 'Accept-language',
    required: true,
    description: 'Alternative way to specify language preference (ko, en, zh)',
    enum: LanguageCode,
  })
  @ResponseData(GetNewsResponse)
  @ResponseException(HttpStatus.NOT_FOUND, '존재하는 뉴스가 없음')
  async getNews(
    @Param('id', ParseIntPipe) id: number,
    @Headers('Accept-language') acceptLanguage: LanguageCode,
  ): Promise<ResponseDataDto<GetNewsResponse>> {
    const result = await this.newsService.getNews(id, acceptLanguage);

    return new ResponseDataDto(result);
  }

  @Post()
  @ApiOperation({
    summary: '뉴스 데이터 입력',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async postNews(@Body() body: PostNewsRequest) {
    await this.newsService.postNews(body);
  }
}

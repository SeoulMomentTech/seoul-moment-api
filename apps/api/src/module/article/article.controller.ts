import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseException } from '@app/common/decorator/response-exception.decorator';
import { ResponseDataDto } from '@app/common/type/response-data';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiHeader, ApiOperation } from '@nestjs/swagger';

import { GetArticleResponse } from './article.dto';
import { ArticleService } from './article.service';

@Controller('article')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

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
}

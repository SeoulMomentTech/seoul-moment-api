import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ArticleRepositoryService } from '@app/repository/service/article.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';

import { GetArticleResponse } from './article.dto';

@Injectable()
export class ArticleService {
  constructor(
    private readonly articleRepositoryService: ArticleRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  async getArticle(
    id: number,
    languageCode: LanguageCode,
  ): Promise<GetArticleResponse> {
    const [articleEntity, lastArticleEntityList] = await Promise.all([
      this.articleRepositoryService.getArticleById(id),
      this.articleRepositoryService.findLastArticleByCount(3),
    ]);

    const [articleText, sectionText, lastArticleText] = await Promise.all([
      this.languageRepositoryService.findMultilingualTexts(
        EntityType.ARTICLE,
        articleEntity.id,
        languageCode,
      ),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.ARTICLE_SECTION,
        articleEntity.section.map((v) => v.id),
        languageCode,
      ),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.ARTICLE,
        lastArticleEntityList.map((v) => v.id),
        languageCode,
      ),
    ]);

    return GetArticleResponse.from(
      articleEntity,
      {
        text: articleText,
        sectionText,
      },
      lastArticleEntityList,
      lastArticleText,
      languageCode,
    );
  }
}

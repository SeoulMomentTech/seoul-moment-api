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
    const articleEntity =
      await this.articleRepositoryService.getArticleById(id);

    const [articleText, sectionText] = await Promise.all([
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
    ]);

    return GetArticleResponse.from(
      articleEntity,
      {
        text: articleText,
        sectionText,
      },
      languageCode,
    );
  }
}

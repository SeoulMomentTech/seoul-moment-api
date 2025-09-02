import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { NewsRepositoryService } from '@app/repository/service/news.repository.service';
import { Injectable } from '@nestjs/common';

import { GetNewsResponse } from './news.dto';

@Injectable()
export class NewsService {
  constructor(
    private readonly newsRepositoryService: NewsRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
  ) {}

  async getNews(
    id: number,
    languageCode: LanguageCode,
  ): Promise<GetNewsResponse> {
    const newsEntity = await this.newsRepositoryService.getNewsById(id);

    const [newsText, sectionText] = await Promise.all([
      this.languageRepositoryService.findMultilingualTexts(
        EntityType.NEWS,
        newsEntity.id,
        languageCode,
      ),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.NEWS_SECTION,
        newsEntity.section.map((v) => v.id),
        languageCode,
      ),
    ]);

    return GetNewsResponse.from(
      newsEntity,
      {
        text: newsText,
        sectionText,
      },
      languageCode,
    );
  }
}

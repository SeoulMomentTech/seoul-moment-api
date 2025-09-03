import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ArticleRepositoryService } from '@app/repository/service/article.repository.service';
import { HomeRepositoryService } from '@app/repository/service/home.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { NewsRepositoryService } from '@app/repository/service/news.repository.service';
import { Injectable } from '@nestjs/common';

import { GetHomeResponse } from './home.dto';

@Injectable()
export class HomeService {
  constructor(
    private readonly homeRepositoryService: HomeRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
    private readonly newsRepositoryService: NewsRepositoryService,
    private readonly articleRepositoryService: ArticleRepositoryService,
  ) {}

  async getHome(language: LanguageCode): Promise<GetHomeResponse> {
    const [homeEntity, newsEntityList, articleEntityList] = await Promise.all([
      this.homeRepositoryService.findHome(),
      this.newsRepositoryService.findLastNewsByCount(3),
      this.articleRepositoryService.findLastArticleByCount(2),
    ]);

    const [homeSectionText, newsText, articleText] = await Promise.all([
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.HOME_SECTION,
        homeEntity.section.map((v) => v.id),
        language,
      ),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.NEWS,
        newsEntityList.map((v) => v.id),
        language,
      ),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.ARTICLE,
        articleEntityList.map((v) => v.id),
        language,
      ),
    ]);

    return GetHomeResponse.from(
      homeEntity.banner,
      homeEntity.section,
      homeSectionText,
      newsEntityList,
      newsText,
      articleEntityList,
      articleText,
    );
  }
}

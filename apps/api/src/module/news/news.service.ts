import { NewsCategoryEntity } from '@app/repository/entity/news-category.entity';
import { NewsHashtagEntity } from '@app/repository/entity/news-hashtag.entity';
import { NewsEntity } from '@app/repository/entity/news.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { NewsRepositoryService } from '@app/repository/service/news.repository.service';
import { Injectable } from '@nestjs/common';

import {
  GetNewsCategoryResponse,
  GetNewsDashboardResponse,
  GetNewsListResponse,
  GetNewsResponse,
} from './news.dto';

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
    const [newsEntity, lastNewsEntityList] = await Promise.all([
      this.newsRepositoryService.getNewsById(id),
      this.newsRepositoryService.findLastNewsByCountWithId(3, id),
    ]);

    const [newsText, sectionText, lastNewsText, categoryText] =
      await Promise.all([
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
        this.languageRepositoryService.findMultilingualTextsByEntities(
          EntityType.NEWS,
          lastNewsEntityList.map((v) => v.id),
          languageCode,
        ),
        this.languageRepositoryService.findMultilingualTexts(
          EntityType.CATEGORY,
          newsEntity.category.id,
          languageCode,
        ),
      ]);

    return GetNewsResponse.from(
      newsEntity,
      {
        text: newsText,
        sectionText,
      },
      lastNewsEntityList,
      lastNewsText,
      categoryText,
      languageCode,
    );
  }

  async getNewsList(
    count: number,
    language: LanguageCode,
  ): Promise<GetNewsListResponse[]> {
    const newsEntites =
      await this.newsRepositoryService.findLastNewsByCount(count);

    const newsText =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.NEWS,
        newsEntites.map((v) => v.id),
        language,
      );

    return newsEntites.map((v) => GetNewsListResponse.from(v, newsText));
  }

  async getNewsDashboard(
    language: LanguageCode,
  ): Promise<GetNewsDashboardResponse> {
    const {
      recentList,
      editorPickList,
      newsCategoryList,
      hashtagList,
      selectedHashtag,
      newsCategoryEntityList,
    } = await this.findDashboardNewsLists();

    const newsIds = [
      ...new Set(
        [
          ...recentList,
          ...editorPickList,
          ...newsCategoryList,
          ...hashtagList,
        ].map((v) => v.id),
      ),
    ];

    const [newsText, hashtagName] = await Promise.all([
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.NEWS,
        newsIds,
        language,
      ),
      this.findDashboardHashtagName(selectedHashtag, language),
    ]);

    return {
      recentList: recentList.map((v) => GetNewsListResponse.from(v, newsText)),
      editorPickList: editorPickList.map((v) =>
        GetNewsListResponse.from(v, newsText),
      ),
      hashtag: {
        name: hashtagName,
        list: hashtagList.map((v) => GetNewsListResponse.from(v, newsText)),
      },
      newsCategoryCardList: newsCategoryList.map((v) =>
        GetNewsListResponse.from(v, newsText),
      ),
      newsCategoryList: newsCategoryEntityList.map((v) =>
        GetNewsCategoryResponse.from(v),
      ),
    };
  }

  async getNewsByNewsCategoryId(
    newsCategoryId: number,
    language: LanguageCode,
  ): Promise<GetNewsListResponse[]> {
    const newsEntites =
      await this.newsRepositoryService.findNewsByNewsCategoryId(newsCategoryId);

    const newsText =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.NEWS,
        newsEntites.map((v) => v.id),
        language,
      );
    return newsEntites.map((v) => GetNewsListResponse.from(v, newsText));
  }

  private async findDashboardHashtagName(
    hashtag: NewsHashtagEntity | undefined,
    language: LanguageCode,
  ): Promise<string | undefined> {
    if (!hashtag) {
      return undefined;
    }

    const nameTextList =
      await this.languageRepositoryService.findMultilingualTexts(
        EntityType.NEWS_HASHTAG,
        hashtag.id,
        language,
        'name',
      );

    return nameTextList[0]?.textContent;
  }

  // eslint-disable-next-line max-lines-per-function
  private async findDashboardNewsLists(): Promise<{
    recentList: NewsEntity[];
    editorPickList: NewsEntity[];
    newsCategoryList: NewsEntity[];
    hashtagList: NewsEntity[];
    selectedHashtag?: NewsHashtagEntity;
    newsCategoryEntityList: NewsCategoryEntity[];
  }> {
    const [hashtagEntityList, newsCategoryEntityList] = await Promise.all([
      this.newsRepositoryService.findNewsHashtagList(),
      this.newsRepositoryService.findNewsCategoryList(),
    ]);

    const newsCategoryId = newsCategoryEntityList[0]?.id;
    const selectedHashtag = hashtagEntityList[0];

    const emptyResult: [NewsEntity[], number] = [[], 0];

    const [[recentList], [editorPickList], [newsCategoryList], [hashtagList]] =
      await Promise.all([
        this.newsRepositoryService.findNewsByFilter({ page: 1, count: 5 }),
        this.newsRepositoryService.findNewsByFilter({
          page: 1,
          count: 4,
          isEditorPick: true,
        }),
        newsCategoryId
          ? this.newsRepositoryService.findNewsByFilter({
              page: 1,
              count: 5,
              newsCategoryId,
            })
          : emptyResult,
        selectedHashtag
          ? this.newsRepositoryService.findNewsByFilter({
              page: 1,
              count: 5,
              hashtagId: selectedHashtag.id,
            })
          : emptyResult,
      ]);

    return {
      recentList,
      editorPickList,
      newsCategoryList,
      hashtagList,
      selectedHashtag,
      newsCategoryEntityList,
    };
  }
}

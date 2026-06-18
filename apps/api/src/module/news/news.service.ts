import { NewsCategoryEntity } from '@app/repository/entity/news-category.entity';
import { NewsHashtagEntity } from '@app/repository/entity/news-hashtag.entity';
import { NewsEntity } from '@app/repository/entity/news.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { NewsRepositoryService } from '@app/repository/service/news.repository.service';
import { Injectable } from '@nestjs/common';

import {
  GetNewsCardListResponse,
  GetNewsCategoryRequest,
  GetNewsCategoryResponse,
  GetNewsDashboardResponse,
  GetNewsListResponse,
  GetNewsResponse,
} from './news.dto';

interface DashboardNewsLists {
  recentList: NewsEntity[];
  editorPickList: NewsEntity[];
  newsCategoryList: NewsEntity[];
  hashtagList: NewsEntity[];
  selectedHashtag?: NewsHashtagEntity;
  newsCategoryEntityList: NewsCategoryEntity[];
}

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
    const lists = await this.findDashboardNewsLists();
    const newsIds = this.collectDashboardNewsIds(lists);

    const [newsText, hashtagName, newsCategoryText] = await Promise.all([
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.NEWS,
        newsIds,
        language,
      ),
      this.findDashboardHashtagName(lists.selectedHashtag, language),
      this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.NEWS_CATEGORY,
        lists.newsCategoryEntityList.map((v) => v.id),
        language,
      ),
    ]);

    const toCardList = (list: NewsEntity[]) =>
      list.map((v) =>
        GetNewsCardListResponse.from(v, newsText, newsCategoryText),
      );

    return {
      recentList: toCardList(lists.recentList),
      editorPickList: toCardList(lists.editorPickList),
      hashtag: {
        name: hashtagName,
        list: toCardList(lists.hashtagList),
      },
      newsCategoryCardList: toCardList(lists.newsCategoryList),
      newsCategoryList: lists.newsCategoryEntityList.map((v) =>
        GetNewsCategoryResponse.from(v, newsCategoryText),
      ),
    };
  }

  private collectDashboardNewsIds(lists: DashboardNewsLists): number[] {
    return [
      ...new Set(
        [
          ...lists.recentList,
          ...lists.editorPickList,
          ...lists.newsCategoryList,
          ...lists.hashtagList,
        ].map((v) => v.id),
      ),
    ];
  }

  async getNewsByNewsCategoryFilter(
    query: GetNewsCategoryRequest,
    language: LanguageCode,
  ): Promise<[GetNewsCardListResponse[], number]> {
    const [newsEntites, total] =
      await this.newsRepositoryService.findNewsByNewsCategoryFilter(
        query.count,
        query.page,
        query.sort,
        query.categoryId,
      );

    const newsText =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.NEWS,
        newsEntites.map((v) => v.id),
        language,
      );

    const newsCategoryText =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.NEWS_CATEGORY,
        newsEntites.map((v) => v.newsCategoryId),
        language,
      );

    return [
      newsEntites.map((v) =>
        GetNewsCardListResponse.from(v, newsText, newsCategoryText),
      ),
      total,
    ];
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
  private async findDashboardNewsLists(): Promise<DashboardNewsLists> {
    const [hashtagEntityList, newsCategoryEntityList] = await Promise.all([
      this.newsRepositoryService.findNewsHashtagList(),
      this.newsRepositoryService.findNewsCategoryList(),
    ]);

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
        this.newsRepositoryService.findNewsByFilter({ page: 1, count: 4 }),
        selectedHashtag
          ? this.newsRepositoryService.findNewsByFilter({
              page: 1,
              count: 4,
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

/* eslint-disable max-lines-per-function */
import { NewsSectionImageEntity } from '@app/repository/entity/news-section-image.entity';
import { NewsSectionEntity } from '@app/repository/entity/news-section.entity';
import { NewsEntity } from '@app/repository/entity/news.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { BrandRepositoryService } from '@app/repository/service/brand.repository.service';
import { CategoryRepositoryService } from '@app/repository/service/category.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { NewsRepositoryService } from '@app/repository/service/news.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import {
  GetNewsListResponse,
  GetNewsResponse,
  PostNewsRequest,
} from './news.dto';

@Injectable()
export class NewsService {
  constructor(
    private readonly newsRepositoryService: NewsRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
    private readonly categoryRepositoryService: CategoryRepositoryService,
    private readonly brandRepositoryService: BrandRepositoryService,
  ) {}

  async getNews(
    id: number,
    languageCode: LanguageCode,
  ): Promise<GetNewsResponse> {
    const [newsEntity, lastNewsEntityList] = await Promise.all([
      this.newsRepositoryService.getNewsById(id),
      this.newsRepositoryService.findLastNewsByCount(3),
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

  async postNews(dto: PostNewsRequest) {
    await this.categoryRepositoryService.getCategoryById(dto.categoryId);

    if (dto.brandId) {
      await this.brandRepositoryService.getBrandById(dto.brandId);
    }

    const newsEntity = await this.newsRepositoryService.insert(
      plainToInstance(NewsEntity, {
        brandId: dto.brandId,
        categoryId: dto.categoryId,
        writer: dto.writer,
        banner: dto.banner,
        profileImage: dto.profile,
      }),
    );

    await Promise.all(
      dto.list.flatMap((v) => [
        this.languageRepositoryService.saveMultilingualText(
          EntityType.NEWS,
          newsEntity.id,
          'title',
          v.languageId,
          v.title,
        ),
        this.languageRepositoryService.saveMultilingualText(
          EntityType.NEWS,
          newsEntity.id,
          'content',
          v.languageId,
          v.content,
        ),
      ]),
    );

    for (const section of dto.sectionList) {
      const newsSectionEntity = await this.newsRepositoryService.insertSection(
        plainToInstance(NewsSectionEntity, {
          newsId: newsEntity.id,
        }),
      );

      await Promise.all(
        section.textList.flatMap((v) => [
          this.languageRepositoryService.saveMultilingualText(
            EntityType.NEWS_SECTION,
            newsSectionEntity.id,
            'title',
            v.languageId,
            v.title,
          ),
          this.languageRepositoryService.saveMultilingualText(
            EntityType.NEWS_SECTION,
            newsSectionEntity.id,
            'subTitle',
            v.languageId,
            v.subTitle,
          ),
          this.languageRepositoryService.saveMultilingualText(
            EntityType.NEWS_SECTION,
            newsSectionEntity.id,
            'content',
            v.languageId,
            v.content,
          ),
        ]),
      );

      for (const sectionImage of section.imageUrlList) {
        await this.newsRepositoryService.insertSectionImage(
          plainToInstance(NewsSectionImageEntity, {
            sectionId: newsSectionEntity.id,
            imageUrl: sectionImage,
          }),
        );
      }
    }
  }
}

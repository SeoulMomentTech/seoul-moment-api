/* eslint-disable max-lines-per-function */
import { ArticleSectionImageEntity } from '@app/repository/entity/article-section-image.entity';
import { ArticleSectionEntity } from '@app/repository/entity/article-section.entity';
import { ArticleEntity } from '@app/repository/entity/article.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ArticleRepositoryService } from '@app/repository/service/article.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import {
  GetArticleListResponse,
  GetArticleResponse,
  PostArticleRequest,
} from './article.dto';

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

    const [articleText, sectionText, lastArticleText, categoryText] =
      await Promise.all([
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
        this.languageRepositoryService.findMultilingualTexts(
          EntityType.CATEGORY,
          articleEntity.brand.category.id,
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
      categoryText,
      languageCode,
    );
  }

  async getArticleList(
    count: number,
    language: LanguageCode,
  ): Promise<GetArticleListResponse[]> {
    const articleEntites =
      await this.articleRepositoryService.findLastArticleByCount(count);

    const articleText =
      await this.languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.ARTICLE,
        articleEntites.map((v) => v.id),
        language,
      );

    return articleEntites.map((v) =>
      GetArticleListResponse.from(v, articleText),
    );
  }

  async postArticle(dto: PostArticleRequest) {
    const articleEntity = await this.articleRepositoryService.insert(
      plainToInstance(ArticleEntity, {
        brandId: dto.brandId,
        writer: dto.writer,
        banner: dto.banner,
        profileImage: dto.profile,
      }),
    );

    await Promise.all(
      dto.list.flatMap((v) => [
        this.languageRepositoryService.saveMultilingualText(
          EntityType.ARTICLE,
          articleEntity.id,
          'title',
          v.languageId,
          v.title,
        ),
        this.languageRepositoryService.saveMultilingualText(
          EntityType.ARTICLE,
          articleEntity.id,
          'content',
          v.languageId,
          v.content,
        ),
      ]),
    );

    for (const section of dto.sectionList) {
      const articleSectionEntity =
        await this.articleRepositoryService.insertSection(
          plainToInstance(ArticleSectionEntity, {
            articleId: articleEntity.id,
          }),
        );

      await Promise.all(
        section.textList.flatMap((v) => [
          this.languageRepositoryService.saveMultilingualText(
            EntityType.ARTICLE_SECTION,
            articleSectionEntity.id,
            'title',
            v.languageId,
            v.title,
          ),
          this.languageRepositoryService.saveMultilingualText(
            EntityType.ARTICLE_SECTION,
            articleSectionEntity.id,
            'subTitle',
            v.languageId,
            v.subTitle,
          ),
          this.languageRepositoryService.saveMultilingualText(
            EntityType.NEWS_SECTION,
            articleSectionEntity.id,
            'content',
            v.languageId,
            v.content,
          ),
        ]),
      );

      for (const sectionImage of section.imageUrlList) {
        await this.articleRepositoryService.insertSectionImage(
          plainToInstance(ArticleSectionImageEntity, {
            sectionId: articleSectionEntity.id,
            imageUrl: sectionImage,
          }),
        );
      }
    }
  }
}

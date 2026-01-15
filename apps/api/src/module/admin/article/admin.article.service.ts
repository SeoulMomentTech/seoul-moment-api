/* eslint-disable max-lines-per-function */
import { Configuration } from '@app/config/configuration';
import { UpdateArticleDto } from '@app/repository/dto/article.dto';
import { ArticleSectionImageEntity } from '@app/repository/entity/article-section-image.entity';
import { ArticleSectionEntity } from '@app/repository/entity/article-section.entity';
import { ArticleEntity } from '@app/repository/entity/article.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { ArticleRepositoryService } from '@app/repository/service/article.repository.service';
import { BrandRepositoryService } from '@app/repository/service/brand.repository.service';
import { CategoryRepositoryService } from '@app/repository/service/category.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  AdminArticleListRequest,
  GetAdminArticleInfoResponse,
  GetAdminArticleInfoText,
  GetAdminArticleResponse,
  GetAdminArticleTextDto,
  PostAdminArticleRequest,
  UpdateAdminArticleRequest,
  V2UpdateAdminArticleRequest,
} from './admin.article.dto';

@Injectable()
export class AdminArticleService {
  constructor(
    private readonly articleRepositoryService: ArticleRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
    private readonly categoryRepositoryService: CategoryRepositoryService,
    private readonly brandRepositoryService: BrandRepositoryService,
  ) {}

  async getAdminArticleList(
    request: AdminArticleListRequest,
  ): Promise<[GetAdminArticleResponse[], number]> {
    const [articleEntityList, total] =
      await this.articleRepositoryService.findArticleByFilter(
        request.page,
        request.count,
        request.search,
        request.searchColumn,
        request.sort,
      );

    const languageArray =
      await this.languageRepositoryService.findAllActiveLanguages();

    const articleList = await Promise.all(
      articleEntityList.map(async (articleEntity) => {
        const nameDto = await Promise.all(
          languageArray.map(async (languageEntity) => {
            const titleMultilingualText =
              await this.languageRepositoryService.findMultilingualTexts(
                EntityType.ARTICLE,
                articleEntity.id,
                languageEntity.code,
                'title',
              );

            const contentMultilingualTexts =
              await this.languageRepositoryService.findMultilingualTexts(
                EntityType.ARTICLE,
                articleEntity.id,
                languageEntity.code,
                'content',
              );

            if (titleMultilingualText.length > 0) {
              return GetAdminArticleTextDto.from(
                languageEntity.code,
                titleMultilingualText[0].textContent,
                contentMultilingualTexts[0].textContent,
              );
            }
            return null;
          }),
        );
        return GetAdminArticleResponse.from(articleEntity, nameDto);
      }),
    );

    return [articleList, total];
  }

  async getAdminArticleInfo(id: number): Promise<GetAdminArticleInfoResponse> {
    const articleEntity =
      await this.articleRepositoryService.getArticleById(id);

    const languageArray =
      await this.languageRepositoryService.findAllActiveLanguages();

    const articleMultilingualList: {
      languageId: number;
      articleText: MultilingualTextEntity[];
      sectionText: MultilingualTextEntity[];
    }[] = [];

    for (const languageEntity of languageArray) {
      const [articleTexts, sectionTexts] = await Promise.all([
        this.languageRepositoryService.findMultilingualTexts(
          EntityType.ARTICLE,
          articleEntity.id,
          languageEntity.code,
        ),
        this.languageRepositoryService.findMultilingualTextsByEntities(
          EntityType.ARTICLE_SECTION,
          articleEntity.section.map((section) => section.id),
          languageEntity.code,
        ),
      ]);

      articleMultilingualList.push({
        languageId: languageEntity.id,
        articleText: articleTexts,
        sectionText: sectionTexts,
      });
    }

    return GetAdminArticleInfoResponse.from(
      articleEntity,
      articleMultilingualList,
    );
  }

  async postAdminArticle(dto: PostAdminArticleRequest) {
    await this.categoryRepositoryService.getCategoryById(dto.categoryId);

    if (dto.brandId) {
      await this.brandRepositoryService.getBrandById(dto.brandId);
    }

    const articleEntity = await this.articleRepositoryService.insert(
      plainToInstance(ArticleEntity, {
        brandId: dto.brandId,
        categoryId: dto.categoryId,
        writer: dto.writer,
        banner: dto.banner,
        profileImage: dto.profile,
        homeImage: dto.homeImage,
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
            EntityType.ARTICLE_SECTION,
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

  @Transactional()
  async updateAdminArticle(articleId: number, dto: UpdateAdminArticleRequest) {
    const updateArticleDto: UpdateArticleDto = {
      id: articleId,
      categoryId: dto.categoryId,
      brandId: dto.brandId,
      writer: dto.writer,
      banner: dto.banner,
      profileImage: dto.profile,
      homeImage: dto.homeImage,
    };

    await this.articleRepositoryService.update(updateArticleDto);

    const promises = [];

    if (dto.multilingualTextList && dto.multilingualTextList.length > 0) {
      for (const text of dto.multilingualTextList) {
        if (text.title) {
          promises.push(
            this.languageRepositoryService.saveMultilingualText(
              EntityType.ARTICLE,
              articleId,
              'title',
              text.languageId,
              text.title,
            ),
          );
        }

        if (text.content) {
          promises.push(
            this.languageRepositoryService.saveMultilingualText(
              EntityType.ARTICLE,
              articleId,
              'content',
              text.languageId,
              text.content,
            ),
          );
        }

        if (text.section && text.section.length > 0) {
          for (const section of text.section) {
            if (section.title) {
              promises.push(
                this.languageRepositoryService.saveMultilingualText(
                  EntityType.ARTICLE_SECTION,
                  section.id,
                  'title',
                  text.languageId,
                  section.title,
                ),
              );
            }

            if (section.subTitle) {
              promises.push(
                this.languageRepositoryService.saveMultilingualText(
                  EntityType.ARTICLE_SECTION,
                  section.id,
                  'subTitle',
                  text.languageId,
                  section.subTitle,
                ),
              );
            }

            if (section.content) {
              promises.push(
                this.languageRepositoryService.saveMultilingualText(
                  EntityType.ARTICLE_SECTION,
                  section.id,
                  'content',
                  text.languageId,
                  section.content,
                ),
              );
            }

            if (
              section.sectionImageList &&
              section.sectionImageList.length > 0
            ) {
              for (const sectionImage of section.sectionImageList) {
                if (
                  sectionImage.oldImageUrl === '' ||
                  sectionImage.oldImageUrl === null
                ) {
                  promises.push(
                    this.articleRepositoryService.insertSectionImage(
                      plainToInstance(ArticleSectionImageEntity, {
                        sectionId: section.id,
                        imageUrl: sectionImage.newImageUrl,
                      }),
                    ),
                  );
                } else {
                  promises.push(
                    this.articleRepositoryService.updateSectionImage(
                      sectionImage,
                    ),
                  );
                }
              }
            }
          }
        }
      }
    }

    await Promise.all(promises);
  }

  @Transactional()
  async deleteAdminArticle(articleId: number) {
    const articleEntity =
      await this.articleRepositoryService.getArticleById(articleId);

    await this.articleRepositoryService.delete(articleId);

    await Promise.all(
      articleEntity.section.map((section) =>
        this.languageRepositoryService.deleteMultilingualTexts(
          EntityType.ARTICLE_SECTION,
          section.id,
        ),
      ),
    );
  }

  @Transactional()
  async articleMultilingualUpdate(
    articleId: number,
    list: GetAdminArticleInfoText[],
  ) {
    for (const content of list) {
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.ARTICLE,
        articleId,
        'title',
        content.languageId,
        content.title,
      );
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.ARTICLE,
        articleId,
        'content',
        content.languageId,
        content.content,
      );

      for (const section of content.section) {
        let sectionId = section.id;

        if (!sectionId) {
          const articleSectionEntity =
            await this.articleRepositoryService.insertSection(
              plainToInstance(ArticleSectionEntity, {
                articleId,
              }),
            );

          sectionId = articleSectionEntity.id;
        }

        await this.languageRepositoryService.saveMultilingualText(
          EntityType.ARTICLE_SECTION,
          sectionId,
          'title',
          content.languageId,
          section.title,
        );
        await this.languageRepositoryService.saveMultilingualText(
          EntityType.ARTICLE_SECTION,
          sectionId,
          'subTitle',
          content.languageId,
          section.subTitle,
        );
        await this.languageRepositoryService.saveMultilingualText(
          EntityType.ARTICLE_SECTION,
          sectionId,
          'content',
          content.languageId,
          section.content,
        );

        await this.articleRepositoryService.deleteSectionImageBySectionId(
          sectionId,
        );

        for (const image of section.imageList) {
          await this.articleRepositoryService.insertSectionImage(
            plainToInstance(ArticleSectionImageEntity, {
              sectionId,
              imageUrl: image.replace(
                Configuration.getConfig().IMAGE_DOMAIN_NAME,
                '',
              ),
            }),
          );
        }
      }
    }
  }

  @Transactional()
  async V2UpdateAdminArticle(
    articleId: number,
    dto: V2UpdateAdminArticleRequest,
  ) {
    const articleEntity =
      await this.articleRepositoryService.getArticleById(articleId);

    const updateArticleDto: UpdateArticleDto = {
      id: articleId,
      categoryId: dto.categoryId,
      brandId: dto.brandId,
      writer: dto.writer,
      banner: dto.banner?.replace(
        Configuration.getConfig().IMAGE_DOMAIN_NAME,
        '',
      ),
      profileImage: dto.profile?.replace(
        Configuration.getConfig().IMAGE_DOMAIN_NAME,
        '',
      ),
      homeImage: dto.homeImage?.replace(
        Configuration.getConfig().IMAGE_DOMAIN_NAME,
        '',
      ),
    };

    await this.articleRepositoryService.update(updateArticleDto);

    await this.articleMultilingualUpdate(
      articleEntity.id,
      dto.multilingualTextList,
    );
  }
}

/* eslint-disable max-lines-per-function */
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Configuration } from '@app/config/configuration';
import { UpdateNewsDto } from '@app/repository/dto/news.dto';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { NewsSectionImageEntity } from '@app/repository/entity/news-section-image.entity';
import { NewsSectionEntity } from '@app/repository/entity/news-section.entity';
import { NewsEntity } from '@app/repository/entity/news.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { BrandRepositoryService } from '@app/repository/service/brand.repository.service';
import { CategoryRepositoryService } from '@app/repository/service/category.repository.service';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { NewsRepositoryService } from '@app/repository/service/news.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Transactional } from 'typeorm-transactional';

import {
  AdminNewsListRequest,
  GetAdminNewsInfoText,
  GetAdminNewsInfoResponse,
  GetAdminNewsResponse,
  GetAdminNewsTextDto,
  PostAdminNewsRequest,
  UpdateAdminNewsRequest,
  V2UpdateAdminNewsRequest,
  GetAdminNewsSection,
} from './admin.news.dto';

@Injectable()
export class AdminNewsService {
  constructor(
    private readonly newsRepositoryService: NewsRepositoryService,
    private readonly languageRepositoryService: LanguageRepositoryService,
    private readonly categoryRepositoryService: CategoryRepositoryService,
    private readonly brandRepositoryService: BrandRepositoryService,
  ) {}

  async getAdminNewsList(
    request: AdminNewsListRequest,
  ): Promise<[GetAdminNewsResponse[], number]> {
    const [newsEntityList, total] =
      await this.newsRepositoryService.findNewsByFilter(
        request.page,
        request.count,
        request.search,
        request.searchColumn,
        request.sort,
      );

    const languageArray =
      await this.languageRepositoryService.findAllActiveLanguages();

    const newsList = await Promise.all(
      newsEntityList.map(async (newsEntity) => {
        const nameDto = await Promise.all(
          languageArray.map(async (languageEntity) => {
            const multilingualText =
              await this.languageRepositoryService.findMultilingualTexts(
                EntityType.NEWS,
                newsEntity.id,
                languageEntity.code,
                'title',
              );
            const contentMultilingualText =
              await this.languageRepositoryService.findMultilingualTexts(
                EntityType.NEWS,
                newsEntity.id,
                languageEntity.code,
                'content',
              );
            if (multilingualText.length > 0) {
              return GetAdminNewsTextDto.from(
                languageEntity.code,
                multilingualText[0].textContent,
                contentMultilingualText[0].textContent,
              );
            }
            return null;
          }),
        );
        return GetAdminNewsResponse.from(newsEntity, nameDto);
      }),
    );

    return [newsList, total];
  }

  async getAdminNewsInfo(id: number): Promise<GetAdminNewsInfoResponse> {
    const newsEntity = await this.newsRepositoryService.getNewsById(id);

    const languageArray =
      await this.languageRepositoryService.findAllActiveLanguages();

    const newsMultilingualList: {
      languageId: number;
      newsText: MultilingualTextEntity[];
      sectionText: MultilingualTextEntity[];
    }[] = [];

    for (const languageEntity of languageArray) {
      const [newsTexts, sectionTexts] = await Promise.all([
        this.languageRepositoryService.findMultilingualTexts(
          EntityType.NEWS,
          newsEntity.id,
          languageEntity.code,
        ),
        this.languageRepositoryService.findMultilingualTextsByEntities(
          EntityType.NEWS_SECTION,
          newsEntity.section.map((section) => section.id),
          languageEntity.code,
        ),
      ]);

      newsMultilingualList.push({
        languageId: languageEntity.id,
        newsText: newsTexts,
        sectionText: sectionTexts,
      });
    }

    return GetAdminNewsInfoResponse.from(newsEntity, newsMultilingualList);
  }

  async postAdminNews(dto: PostAdminNewsRequest) {
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
        homeImage: dto.homeImage,
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

  async updateNewsSection(
    sectionId: number,
    languageId: number,
    section: GetAdminNewsSection,
  ) {
    await this.languageRepositoryService.saveMultilingualText(
      EntityType.NEWS_SECTION,
      sectionId,
      'title',
      languageId,
      section.title,
    );
    await this.languageRepositoryService.saveMultilingualText(
      EntityType.NEWS_SECTION,
      sectionId,
      'subTitle',
      languageId,
      section.subTitle,
    );
    await this.languageRepositoryService.saveMultilingualText(
      EntityType.NEWS_SECTION,
      sectionId,
      'content',
      languageId,
      section.content,
    );

    await this.newsRepositoryService.deleteSectionImageBySectionId(sectionId);

    for (const image of section.imageList) {
      await this.newsRepositoryService.insertSectionImage(
        plainToInstance(NewsSectionImageEntity, {
          sectionId,
          imageUrl: image.replace(
            Configuration.getConfig().IMAGE_DOMAIN_NAME,
            '',
          ),
        }),
      );
    }
  }

  @Transactional()
  async newsMultilingualUpdate(newsId: number, list: GetAdminNewsInfoText[]) {
    const newContentList: GetAdminNewsInfoText[] = [];

    for (const content of list) {
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.NEWS,
        newsId,
        'title',
        content.languageId,
        content.title,
      );
      await this.languageRepositoryService.saveMultilingualText(
        EntityType.NEWS,
        newsId,
        'content',
        content.languageId,
        content.content,
      );

      for (const section of content.section) {
        const sectionId = section.id;

        if (!sectionId) {
          newContentList.push(content);
          continue;
        }

        await this.updateNewsSection(sectionId, content.languageId, section);
      }
    }

    const activeLanguage =
      await this.languageRepositoryService.findAllActiveLanguages();

    if (newContentList.length > 0) {
      if (activeLanguage.length === newContentList.length) {
        const newSectionEntity = await this.newsRepositoryService.insertSection(
          plainToInstance(NewsSectionEntity, {
            newsId,
          }),
        );

        for (const content of newContentList) {
          for (const section of content.section) {
            await this.updateNewsSection(
              newSectionEntity.id,
              content.languageId,
              section,
            );
          }
        }
      } else {
        throw new ServiceError(
          `섹션을 추가하려면 활성 언어 수(${activeLanguage.length})와 동일한 개수의 언어별 입력이 필요합니다. 현재 새로운 섹션은 ${newContentList.length}개 추가되었습니다.`,
          ServiceErrorCode.GONE,
        );
      }
    }
  }

  @Transactional()
  async V2UpdateAdminNews(newsId: number, dto: V2UpdateAdminNewsRequest) {
    const newsEntity = await this.newsRepositoryService.getNewsById(newsId);

    const updateNewsDto: UpdateNewsDto = {
      id: newsId,
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

    await this.newsRepositoryService.update(updateNewsDto);

    await this.newsMultilingualUpdate(newsEntity.id, dto.multilingualTextList);
  }

  @Transactional()
  async updateAdminNews(newsId: number, dto: UpdateAdminNewsRequest) {
    const updateNewsDto: UpdateNewsDto = {
      id: newsId,
      categoryId: dto.categoryId,
      brandId: dto.brandId,
      writer: dto.writer,
      banner: dto.banner,
      profileImage: dto.profile,
      homeImage: dto.homeImage,
    };

    await this.newsRepositoryService.update(updateNewsDto);

    const promises = [];

    if (dto.multilingualTextList && dto.multilingualTextList.length > 0) {
      for (const text of dto.multilingualTextList) {
        if (text.title) {
          promises.push(
            this.languageRepositoryService.saveMultilingualText(
              EntityType.NEWS,
              newsId,
              'title',
              text.languageId,
              text.title,
            ),
          );
        }

        if (text.content) {
          promises.push(
            this.languageRepositoryService.saveMultilingualText(
              EntityType.NEWS,
              newsId,
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
                  EntityType.NEWS_SECTION,
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
                  EntityType.NEWS_SECTION,
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
                  EntityType.NEWS_SECTION,
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
                    this.newsRepositoryService.insertSectionImage(
                      plainToInstance(NewsSectionImageEntity, {
                        sectionId: section.id,
                        imageUrl: sectionImage.newImageUrl,
                      }),
                    ),
                  );
                } else {
                  promises.push(
                    this.newsRepositoryService.updateSectionImage(sectionImage),
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
  async deleteAdminNews(newsId: number) {
    const newsEntity = await this.newsRepositoryService.getNewsById(newsId);

    await this.newsRepositoryService.delete(newsId);

    await Promise.all(
      newsEntity.section.map((section) =>
        this.languageRepositoryService.deleteMultilingualTexts(
          EntityType.NEWS_SECTION,
          section.id,
        ),
      ),
    );
  }
}

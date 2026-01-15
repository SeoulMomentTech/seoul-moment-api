import { DatabaseSort } from '@app/common/enum/global.enum';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UpdateAdminArticleImage } from 'apps/api/src/module/admin/article/admin.article.dto';
import { In, Like, Not, Repository } from 'typeorm';

import { UpdateArticleDto } from '../dto/article.dto';
import { ArticleSectionImageEntity } from '../entity/article-section-image.entity';
import { ArticleSectionEntity } from '../entity/article-section.entity';
import { ArticleEntity } from '../entity/article.entity';
import { MultilingualTextEntity } from '../entity/multilingual-text.entity';
import { ArticleStatus } from '../enum/article.enum';
import { ArticleSearchEnum } from '../enum/article.repository.enum';
import { EntityType } from '../enum/entity.enum';
import { SortOrderHelper } from '../helper/sort-order.helper';

@Injectable()
export class ArticleRepositoryService {
  constructor(
    @InjectRepository(ArticleEntity)
    private readonly articleRepository: Repository<ArticleEntity>,

    @InjectRepository(ArticleSectionEntity)
    private readonly articleSectionRepository: Repository<ArticleSectionEntity>,

    @InjectRepository(ArticleSectionImageEntity)
    private readonly articleSectionImageRepository: Repository<ArticleSectionImageEntity>,

    @InjectRepository(MultilingualTextEntity)
    private readonly multilingualTextRepository: Repository<MultilingualTextEntity>,

    private readonly sortOrderHelper: SortOrderHelper,
  ) {}

  async findAllNormalArticleList(): Promise<ArticleEntity[]> {
    return this.articleRepository.findBy({
      status: ArticleStatus.NORMAL,
    });
  }

  async findArticleById(id: number): Promise<ArticleEntity | null> {
    return this.articleRepository.findOneBy({
      id,
      status: ArticleStatus.NORMAL,
    });
  }

  async findLastArticleByCount(count: number): Promise<ArticleEntity[]> {
    return this.articleRepository.find({
      where: {
        status: ArticleStatus.NORMAL,
      },
      order: {
        createDate: 'DESC',
      },
      take: count,
    });
  }
  async findLastArticleByCountWithId(
    count: number,
    id: number,
  ): Promise<ArticleEntity[]> {
    return this.articleRepository.find({
      where: {
        status: ArticleStatus.NORMAL,
        id: Not(id),
      },
      order: {
        createDate: 'DESC',
      },
      take: count,
    });
  }

  async getArticleById(id: number): Promise<ArticleEntity> {
    const result = await this.articleRepository.findOne({
      where: {
        id,
        status: ArticleStatus.NORMAL,
      },
      relations: ['category', 'brand', 'section', 'section.sectionImage'],
    });

    if (!result) {
      throw new ServiceError(
        'Article not found or not in normal status',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

  async insert(entity: ArticleEntity): Promise<ArticleEntity> {
    return this.articleRepository.save(entity);
  }

  async insertSection(
    entity: ArticleSectionEntity,
  ): Promise<ArticleSectionEntity> {
    await this.sortOrderHelper.setNextSortOrder(
      entity,
      this.articleSectionRepository,
    );

    return this.articleSectionRepository.save(entity);
  }

  async insertSectionImage(
    entity: ArticleSectionImageEntity,
  ): Promise<ArticleSectionImageEntity> {
    await this.sortOrderHelper.setNextSortOrder(
      entity,
      this.articleSectionImageRepository,
    );

    return this.articleSectionImageRepository.save(entity);
  }

  async findArticleByFilter(
    page: number,
    count: number,
    searchName?: string,
    searchColumn?: ArticleSearchEnum,
    sort: DatabaseSort = DatabaseSort.DESC,
  ): Promise<[ArticleEntity[], number]> {
    let articleIds: number[] = [];

    if (searchName) {
      const multilingualTexts = await this.multilingualTextRepository.find({
        where: {
          entityType: EntityType.ARTICLE,
          fieldName: searchColumn,
          textContent: Like(`%${searchName}%`),
        },
      });

      articleIds = multilingualTexts.map((text) => text.entityId);
    }

    const [articleEntities, total] = await this.articleRepository.findAndCount({
      where: {
        id: searchName ? In(articleIds) : undefined,
      },
      order: {
        createDate: sort,
      },
      skip: (page - 1) * count,
      take: count,
    });

    return [articleEntities, total];
  }

  async update(entity: UpdateArticleDto): Promise<ArticleEntity> {
    return this.articleRepository.save(entity);
  }

  async updateSectionImage(dto: UpdateAdminArticleImage) {
    await this.articleSectionImageRepository.update(
      { imageUrl: dto.oldImageUrl },
      { imageUrl: dto.newImageUrl },
    );
  }

  async delete(id: number) {
    await this.articleRepository.delete(id);
  }

  async deleteSectionImageBySectionId(sectionId: number) {
    await this.articleSectionImageRepository.delete({ sectionId });
  }
}

import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ArticleSectionImageEntity } from '../entity/article-section-image.entity';
import { ArticleSectionEntity } from '../entity/article-section.entity';
import { ArticleEntity } from '../entity/article.entity';
import { ArticleStatus } from '../enum/article.enum';
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
}

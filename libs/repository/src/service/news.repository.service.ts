import { DatabaseSort } from '@app/common/enum/global.enum';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UpdateAdminNewsImage } from 'apps/api/src/module/admin/news/admin.news.dto';
import { In, Like, Not, Repository } from 'typeorm';

import { UpdateNewsDto } from '../dto/news.dto';
import { MultilingualTextEntity } from '../entity/multilingual-text.entity';
import { NewsSectionImageEntity } from '../entity/news-section-image.entity';
import { NewsSectionEntity } from '../entity/news-section.entity';
import { NewsEntity } from '../entity/news.entity';
import { EntityType } from '../enum/entity.enum';
import { NewsStatus } from '../enum/news.enum';
import { NewsSearchEnum } from '../enum/news.repository.enum';
import { SortOrderHelper } from '../helper/sort-order.helper';

@Injectable()
export class NewsRepositoryService {
  constructor(
    @InjectRepository(NewsEntity)
    private readonly newsRepository: Repository<NewsEntity>,

    @InjectRepository(NewsSectionEntity)
    private readonly newsSectionRepository: Repository<NewsSectionEntity>,

    @InjectRepository(NewsSectionImageEntity)
    private readonly newsSectionImageRepository: Repository<NewsSectionImageEntity>,

    @InjectRepository(MultilingualTextEntity)
    private readonly multilingualTextRepository: Repository<MultilingualTextEntity>,

    private readonly sortOrderHelper: SortOrderHelper,
  ) {}

  async findAllNormalNewsList(): Promise<NewsEntity[]> {
    return this.newsRepository.findBy({
      status: NewsStatus.NORMAL,
    });
  }

  async findNewsById(id: number): Promise<NewsEntity | null> {
    return this.newsRepository.findOneBy({
      id,
      status: NewsStatus.NORMAL,
    });
  }

  async findLastNewsByCount(count: number): Promise<NewsEntity[]> {
    return this.newsRepository.find({
      where: {
        status: NewsStatus.NORMAL,
      },
      order: {
        createDate: 'DESC',
      },
      take: count,
    });
  }

  async findLastNewsByCountWithId(
    count: number,
    id: number,
  ): Promise<NewsEntity[]> {
    return this.newsRepository.find({
      where: {
        status: NewsStatus.NORMAL,
        id: Not(id),
      },
      order: {
        createDate: 'DESC',
      },
      take: count,
    });
  }

  async getNewsById(id: number): Promise<NewsEntity> {
    const result = await this.newsRepository.findOneBy({
      id,
      status: NewsStatus.NORMAL,
    });

    if (!result) {
      throw new ServiceError(
        'News not found or not in normal status',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }

  async insert(entity: NewsEntity): Promise<NewsEntity> {
    return this.newsRepository.save(entity);
  }

  async insertSection(entity: NewsSectionEntity): Promise<NewsSectionEntity> {
    await this.sortOrderHelper.setNextSortOrder(
      entity,
      this.newsSectionRepository,
    );

    return this.newsSectionRepository.save(entity);
  }

  async insertSectionImage(
    entity: NewsSectionImageEntity,
  ): Promise<NewsSectionImageEntity> {
    await this.sortOrderHelper.setNextSortOrder(
      entity,
      this.newsSectionImageRepository,
    );

    return this.newsSectionImageRepository.save(entity);
  }

  async findNewsByFilter(
    page: number,
    count: number,
    searchName?: string,
    searchColumn?: NewsSearchEnum,
    sort: DatabaseSort = DatabaseSort.DESC,
  ): Promise<[NewsEntity[], number]> {
    let newsIds: number[] = [];

    if (searchName) {
      const multilingualTexts = await this.multilingualTextRepository.find({
        where: {
          entityType: EntityType.NEWS,
          fieldName: searchColumn,
          textContent: Like(`%${searchName}%`),
        },
      });

      newsIds = multilingualTexts.map((text) => text.entityId);
    }

    const [newsEntities, total] = await this.newsRepository.findAndCount({
      where: {
        id: searchName ? In(newsIds) : undefined,
      },
      order: {
        createDate: sort,
      },
      skip: (page - 1) * count,
      take: count,
    });

    return [newsEntities, total];
  }

  async update(entity: UpdateNewsDto): Promise<NewsEntity> {
    return this.newsRepository.save(entity);
  }

  async updateSectionImage(dto: UpdateAdminNewsImage) {
    await this.newsSectionImageRepository.update(
      { imageUrl: dto.oldImageUrl },
      { imageUrl: dto.newImageUrl },
    );
  }
  async delete(id: number) {
    await this.newsRepository.delete(id);
  }
}

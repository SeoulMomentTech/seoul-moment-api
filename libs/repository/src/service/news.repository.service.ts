import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NewsSectionImageEntity } from '../entity/news-section-image.entity';
import { NewsSectionEntity } from '../entity/news-section.entity';
import { NewsEntity } from '../entity/news.entity';
import { NewsStatus } from '../enum/news.enum';
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
}

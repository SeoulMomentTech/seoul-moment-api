import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ArticleEntity } from '../entity/article.entity';
import { ArticleStatus } from '../enum/article.enum';

@Injectable()
export class ArticleRepositoryService {
  constructor(
    @InjectRepository(ArticleEntity)
    private readonly articleRepository: Repository<ArticleEntity>,
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
    const result = await this.articleRepository.findOneBy({
      id,
      status: ArticleStatus.NORMAL,
    });

    if (!result) {
      throw new ServiceError(
        'Article not found or not in normal status',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }
}

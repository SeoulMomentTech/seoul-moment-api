import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';

import { UpdateHomeBannerDto } from '../dto/home.dto';
import { HomeBannerImageEntity } from '../entity/home-banner-image.entity';
import { SortOrderHelper } from '../helper/sort-order.helper';

@Injectable()
export class HomeRepositoryService {
  constructor(
    @InjectRepository(HomeBannerImageEntity)
    private readonly homeBannerRepository: Repository<HomeBannerImageEntity>,

    private readonly sortOrderHelper: SortOrderHelper,
  ) {}

  private findHomeBannerBaseQuery(): FindManyOptions<HomeBannerImageEntity> {
    return {
      order: {
        sortOrder: 'ASC',
      },
    };
  }

  async findHome(): Promise<HomeBannerImageEntity[]> {
    return this.homeBannerRepository.find(this.findHomeBannerBaseQuery());
  }

  async findHomeBanner(): Promise<HomeBannerImageEntity[]> {
    return this.homeBannerRepository.find({
      ...this.findHomeBannerBaseQuery(),
    });
  }

  async insertHomeBanner(
    homeBanner: HomeBannerImageEntity,
  ): Promise<HomeBannerImageEntity> {
    await this.sortOrderHelper.setNextSortOrder(
      homeBanner,
      this.homeBannerRepository,
    );

    return this.homeBannerRepository.save(homeBanner);
  }

  async updateHomeBanner(homeBanner: UpdateHomeBannerDto): Promise<void> {
    await this.homeBannerRepository.update(homeBanner.id, homeBanner);
  }

  async softDeleteHomeBanner(id: number): Promise<void> {
    await this.homeBannerRepository.softDelete(id);
  }

  async getHomeBannerById(id: number): Promise<HomeBannerImageEntity> {
    const result = await this.homeBannerRepository.findOneBy({ id });

    if (!result) {
      throw new ServiceError(
        `Home banner not found id: ${id}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }

    return result;
  }
}

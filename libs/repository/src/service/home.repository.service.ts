import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { HomeDto, UpdateHomeBannerDto } from '../dto/home.dto';
import { HomeBannerImageEntity } from '../entity/home-banner-image.entity';
import { HomeSectionEntity } from '../entity/home-section.entity';
import { HomeBannerStatus } from '../enum/home-banner-image.enum';
import { SortOrderHelper } from '../helper/sort-order.helper';

@Injectable()
export class HomeRepositoryService {
  constructor(
    @InjectRepository(HomeBannerImageEntity)
    private readonly homeBannerRepository: Repository<HomeBannerImageEntity>,

    @InjectRepository(HomeSectionEntity)
    private readonly homeSectionRepository: Repository<HomeSectionEntity>,

    private readonly sortOrderHelper: SortOrderHelper,
  ) {}

  async findHome(): Promise<HomeDto> {
    const bannerList = await this.homeBannerRepository.find({
      where: {
        status: HomeBannerStatus.NORMAL,
      },
      order: {
        sortOrder: 'ASC',
      },
    });

    const sectionList = await this.homeSectionRepository.find({
      order: {
        sortOrder: 'ASC',
      },
    });

    return HomeDto.from(bannerList, sectionList);
  }

  async findHomeBanner(): Promise<HomeBannerImageEntity[]> {
    return this.homeBannerRepository.find({
      order: {
        sortOrder: 'ASC',
      },
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

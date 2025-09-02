import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { HomeDto } from '../dto/home.dto';
import { HomeBannerImageEntity } from '../entity/home-banner-image.entity';
import { HomeSectionEntity } from '../entity/home-section.entity';

@Injectable()
export class HomeRepositoryService {
  constructor(
    @InjectRepository(HomeBannerImageEntity)
    private readonly homeBannerRepository: Repository<HomeBannerImageEntity>,

    @InjectRepository(HomeSectionEntity)
    private readonly homeSectionRepository: Repository<HomeSectionEntity>,
  ) {}

  async findHome(): Promise<HomeDto> {
    const bannerList = await this.homeBannerRepository.find({
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
}

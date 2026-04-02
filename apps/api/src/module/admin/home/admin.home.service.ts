import { stripImageDomain } from '@app/common/util/image.util';
import { UpdateHomeBannerDto } from '@app/repository/dto/home.dto';
import { HomeBannerImageEntity } from '@app/repository/entity/home-banner-image.entity';
import { HomeRepositoryService } from '@app/repository/service/home.repository.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { GetHomeBannerResponse } from './admin.home.dto';
import { V1GetHomeBannerResponse } from './v1/admin.home.v1.dto';

@Injectable()
export class AdminHomeService {
  constructor(private readonly homeRepositoryService: HomeRepositoryService) {}

  async getHomeBanner(): Promise<GetHomeBannerResponse[]> {
    const bannerList = await this.homeRepositoryService.findHomeBanner();

    return bannerList.map((banner) => GetHomeBannerResponse.from(banner));
  }

  async v1GetHomeBanner(): Promise<V1GetHomeBannerResponse[]> {
    const bannerList = await this.homeRepositoryService.findHomeBanner();

    return bannerList.map((banner) => V1GetHomeBannerResponse.from(banner));
  }

  async postHomeBanner(
    imageUrl: string,
    mobileImageUrl: string,
  ): Promise<void> {
    await this.homeRepositoryService.insertHomeBanner(
      plainToInstance(HomeBannerImageEntity, {
        imageUrl: stripImageDomain(imageUrl),
        mobileImageUrl: stripImageDomain(mobileImageUrl),
      }),
    );
  }

  async patchHomeBanner(
    id: number,
    imageUrl: string,
    mobileImageUrl: string,
  ): Promise<void> {
    const banner = await this.homeRepositoryService.getHomeBannerById(id);

    const updateDto: UpdateHomeBannerDto = {
      id: banner.id,
      imageUrl: stripImageDomain(imageUrl),
      mobileImageUrl: stripImageDomain(mobileImageUrl),
    };

    await this.homeRepositoryService.updateHomeBanner(updateDto);
  }

  async deleteHomeBanner(id: number): Promise<void> {
    await this.homeRepositoryService.softDeleteHomeBanner(id);
  }
}

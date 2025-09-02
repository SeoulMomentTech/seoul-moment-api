import { plainToInstance } from 'class-transformer';

import { HomeBannerImageEntity } from '../entity/home-banner-image.entity';
import { HomeSectionEntity } from '../entity/home-section.entity';

export class HomeDto {
  banner: HomeBannerImageEntity[];
  section: HomeSectionEntity[];

  static from(banner: HomeBannerImageEntity[], section: HomeSectionEntity[]) {
    return plainToInstance(this, {
      banner,
      section,
    });
  }
}

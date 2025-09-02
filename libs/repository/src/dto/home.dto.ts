import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

import { HomeBannerImageEntity } from '../entity/home-banner-image.entity';
import { HomeSectionEntity } from '../entity/home-section.entity';

export class HomeDto {
  @ApiProperty({
    description: '홈 배너 이미지 리스트',
    type: [HomeBannerImageEntity],
  })
  banner: HomeBannerImageEntity[];

  @ApiProperty({ description: '홈 섹션 리스트', type: [HomeSectionEntity] })
  section: HomeSectionEntity[];

  static from(banner: HomeBannerImageEntity[], section: HomeSectionEntity[]) {
    return plainToInstance(this, {
      banner,
      section,
    });
  }
}

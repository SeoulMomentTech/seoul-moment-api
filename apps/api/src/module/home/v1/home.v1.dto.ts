import { ArticleEntity } from '@app/repository/entity/article.entity';
import { HomeBannerImageEntity } from '@app/repository/entity/home-banner-image.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { NewsEntity } from '@app/repository/entity/news.entity';
import { PromotionEntity } from '@app/repository/entity/promotion.entity';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

import { MultilingualFieldDto } from '../../dto/multilingual.dto';
import { GetHomePromotion } from '../home.dto';

export class V1GetHomeBanner {
  @ApiProperty({
    description: '배너 이미지 URL',
    example:
      'https://image-dev.seoulmoment.com.tw/home-banners/2025-09-16/home-banner-01.jpg',
  })
  imageUrl: string;

  @ApiProperty({
    description: '모바일 배너 이미지 URL',
    example:
      'https://image-dev.seoulmoment.com.tw/home-banners/2025-09-16/home-banner-01-mobile.jpg',
  })
  mobileImageUrl: string;

  static from(entity: HomeBannerImageEntity) {
    return plainToInstance(this, {
      imageUrl: entity.getImage(),
      mobileImageUrl: entity.getMobileImage(),
    });
  }
}

export class V1GetHomeNews {
  @ApiProperty({ description: '뉴스 ID', example: 1 })
  id: number;

  @ApiProperty({
    description: '뉴스 제목',
    example: '서울모먼트 신제품 출시',
  })
  title: string;

  @ApiProperty({
    description: '뉴스 내용',
    example: '서울모먼트의 새로운 제품이 출시되었습니다...',
  })
  content: string;

  @ApiProperty({ description: '작성자 이름', example: '김서울' })
  writer: string;

  @ApiProperty({
    description: '작성 일시',
    example: '2025-09-03T01:20:45.123Z',
  })
  createDate: string;

  @ApiProperty({
    description: '이미지 URL',
    example:
      'https://image-dev.seoulmoment.com.tw/news/2025-09-16/news-banner.jpg',
  })
  imageUrl: string;

  static from(entity: NewsEntity, multilingualText: MultilingualTextEntity[]) {
    multilingualText = multilingualText.filter((v) => entity.id === v.entityId);

    const title = MultilingualFieldDto.fromByEntity(multilingualText, 'title');
    const content = MultilingualFieldDto.fromByEntity(
      multilingualText,
      'content',
    );

    return plainToInstance(this, {
      id: entity.id,
      title: title.getContent(),
      content: content.getContent(),
      writer: entity.writer,
      createDate: entity.createDate,
      imageUrl: entity.getBannerImage(),
    });
  }
}

export class V1GetHomeArticle {
  @ApiProperty({ description: '아티클 ID', example: 1 })
  id: number;

  @ApiProperty({
    description: '아티클 제목',
    example: '서울의 특별한 순간들',
  })
  title: string;

  @ApiProperty({
    description: '아티클 내용',
    example: '서울모먼트는 서울의 특별한 순간들을 담은 브랜드입니다...',
  })
  content: string;

  @ApiProperty({ description: '작성자 이름', example: '김서울' })
  writer: string;

  @ApiProperty({
    description: '작성 일시',
    example: '2025-09-03T01:20:45.123Z',
  })
  createDate: string;

  @ApiProperty({
    description: '이미지 URL',
    example:
      'https://image-dev.seoulmoment.com.tw/articles/2025-09-16/article-banner.jpg',
  })
  imageUrl: string;

  static from(
    entity: ArticleEntity,
    multilingualText: MultilingualTextEntity[],
  ) {
    multilingualText = multilingualText.filter((v) => entity.id === v.entityId);

    const title = MultilingualFieldDto.fromByEntity(multilingualText, 'title');
    const content = MultilingualFieldDto.fromByEntity(
      multilingualText,
      'content',
    );

    return plainToInstance(this, {
      id: entity.id,
      title: title.getContent(),
      content: content.getContent(),
      writer: entity.writer,
      createDate: entity.createDate,
      imageUrl: entity.getBannerImage(),
    });
  }
}

export class V1GetHomeResponse {
  @ApiProperty({
    description: '홈 배너 이미지 URL 리스트',
    type: [V1GetHomeBanner],
  })
  banner: V1GetHomeBanner[];

  @ApiProperty({
    description: '홈 프로모션 리스트',
    type: [GetHomePromotion],
  })
  promotion: GetHomePromotion[];

  static from(
    banner: HomeBannerImageEntity[],
    promotion: PromotionEntity[],
    promotionMultilingualTextEntity: MultilingualTextEntity[],
  ) {
    return plainToInstance(this, {
      banner: banner.map((v) => V1GetHomeBanner.from(v)),
      promotion: promotion.map((v) =>
        GetHomePromotion.from(v, promotionMultilingualTextEntity),
      ),
    });
  }
}

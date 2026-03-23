import { ArticleEntity } from '@app/repository/entity/article.entity';
import { HomeBannerImageEntity } from '@app/repository/entity/home-banner-image.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { NewsEntity } from '@app/repository/entity/news.entity';
import { PromotionEntity } from '@app/repository/entity/promotion.entity';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';

import { MultilingualFieldDto } from '../dto/multilingual.dto';

export class GetHomePromotion {
  @ApiProperty({ description: '프로모션 ID', example: 1 })
  @IsNumber()
  @IsDefined()
  promotionId: number;

  @ApiProperty({ description: '섹션 제목', example: '2025 S/S Vibes of Seoul' })
  @IsString()
  @IsDefined()
  title: string;

  @ApiProperty({
    description: '섹션 내용',
    example: '새로운 2025 S/S 상품으로 실용적인 제품을 만나보세요.',
  })
  @IsString()
  @IsDefined()
  description: string;

  @ApiProperty({
    description: '섹션 이미지 URL',
    example:
      'https://image-dev.seoulmoment.com.tw/home-sections/2025-09-16/home-section-01.jpg',
  })
  @IsString()
  @IsDefined()
  imageUrl: string;

  static from(
    entity: PromotionEntity,
    multilingualText: MultilingualTextEntity[],
  ) {
    multilingualText = multilingualText.filter((v) => entity.id === v.entityId);

    const title = MultilingualFieldDto.fromByEntity(multilingualText, 'title');

    const description = MultilingualFieldDto.fromByEntity(
      multilingualText,
      'description',
    );

    return plainToInstance(this, {
      promotionId: entity.id,
      title: title.getContent(),
      description: description.getContent(),
      imageUrl: entity.getThumbnailImageUrl(),
    });
  }
}

export class GetHomeNews {
  @ApiProperty({ description: '뉴스 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '뉴스 제목', example: '서울모먼트 신제품 출시' })
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
    example: 'https://example.com/banner.jpg',
  })
  image: string;

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
      image: entity.getBannerImage(),
    });
  }
}

export class GetHomeArticle {
  @ApiProperty({ description: '아티클 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '아티클 제목', example: '서울의 특별한 순간들' })
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
    example: 'https://example.com/banner.jpg',
  })
  image: string;

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
      image: entity.getBannerImage(),
    });
  }
}

export class GetHomePromotionResponse {
  @ApiProperty({ description: '프로모션 ID', example: 1 })
  id: number;

  @ApiProperty({
    description: '프로모션 썸네일 이미지 URL',
    example:
      'https://image-dev.seoulmoment.com.tw/promotions/2025-09-16/promotion-01.jpg',
  })
  thumbnailImageUrl: string;

  @ApiProperty({ description: '프로모션 제목', example: '프로모션 제목' })
  title: string;

  @ApiProperty({ description: '프로모션 내용', example: '프로모션 내용' })
  description: string;

  static from(
    entity: PromotionEntity,
    multilingualText: MultilingualTextEntity[],
  ) {
    multilingualText = multilingualText.filter((v) => entity.id === v.entityId);

    const title = MultilingualFieldDto.fromByEntity(multilingualText, 'title');
    const description = MultilingualFieldDto.fromByEntity(
      multilingualText,
      'description',
    );

    return plainToInstance(this, {
      id: entity.id,
      thumbnailImageUrl: entity.getThumbnailImageUrl(),
      title: title.getContent(),
      description: description.getContent(),
    });
  }
}

export class GetHomeBanner {
  @ApiProperty({
    description: '배너 이미지 URL',
    example: 'https://example.com/banner.jpg',
  })
  image: string;

  @ApiProperty({
    description: '모바일 배너 이미지 URL',
    example: 'https://example.com/mobile-banner.jpg',
  })
  mobileImage: string;

  static from(entity: HomeBannerImageEntity) {
    return plainToInstance(this, {
      image: entity.getImage(),
      mobileImage: entity.getMobileImage(),
    });
  }
}

export class GetHomeResponse {
  @ApiProperty({
    description: '홈 배너 이미지 URL 리스트',
    example: [
      {
        image:
          'https://image-dev.seoulmoment.com.tw/home-banners/2025-09-16/home-banner-01.jpg',
        mobileImage:
          'https://image-dev.seoulmoment.com.tw/home-banners/2025-09-16/home-banner-01-mobile.jpg',
      },
    ],
    type: [GetHomeBanner],
  })
  banner: GetHomeBanner[];

  @ApiProperty({
    description: '프로모션 리스트',
    example: [
      {
        id: 1,
        thumbnailImageUrl:
          'https://image-dev.seoulmoment.com.tw/promotions/2025-09-16/promotion-01.jpg',
        title: '프로모션 제목',
        description: '프로모션 내용',
      },
    ],
    type: [GetHomePromotionResponse],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetHomePromotionResponse)
  @IsDefined()
  promotionList: GetHomePromotionResponse[];

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
      banner: banner.map((v) => GetHomeBanner.from(v)),
      promotion: promotion.map((v) =>
        GetHomePromotion.from(v, promotionMultilingualTextEntity),
      ),
    });
  }
}

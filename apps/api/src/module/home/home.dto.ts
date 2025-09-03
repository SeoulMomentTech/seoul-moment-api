import { ArticleEntity } from '@app/repository/entity/article.entity';
import { HomeBannerImageEntity } from '@app/repository/entity/home-banner-image.entity';
import { HomeSectionEntity } from '@app/repository/entity/home-section.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { NewsEntity } from '@app/repository/entity/news.entity';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

import { MultilingualFieldDto } from '../dto/multilingual.dto';

export class GetHomeSection {
  @ApiProperty({ description: '섹션 제목', example: '2025 S/S Vibes of Seoul' })
  title: string;

  @ApiProperty({
    description: '섹션 내용',
    example: '새로운 2025 S/S 상품으로 실용적인 제품을 만나보세요.',
  })
  description: string;

  @ApiProperty({ description: 'link URL', example: '/production' })
  url: string;

  @ApiProperty({ description: 'link 버튼 이름', example: 'Product detail' })
  urlName: string;

  @ApiProperty({
    description: '섹션 이미지 URL 리스트',
    example: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ],
    type: [String],
  })
  image: string[];

  static from(
    entity: HomeSectionEntity,
    multilingualText: MultilingualTextEntity[],
  ) {
    multilingualText = multilingualText.filter((v) => entity.id === v.entityId);

    const title = MultilingualFieldDto.fromByEntity(multilingualText, 'title');

    const description = MultilingualFieldDto.fromByEntity(
      multilingualText,
      'description',
    );

    return plainToInstance(this, {
      title: title.getContent(),
      description: description.getContent(),
      url: entity.url,
      urlName: entity.urlName,
      image: entity.sectionImage.map((v) => v.getImage()),
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

export class GetHomeResponse {
  banner: string[];
  section: GetHomeSection[];
  news: GetHomeNews[];
  article: GetHomeArticle[];

  static from(
    banner: HomeBannerImageEntity[],
    section: HomeSectionEntity[],
    sectionMultilingualTextEntity: MultilingualTextEntity[],
    news: NewsEntity[],
    newsMultilingualTextEntity: MultilingualTextEntity[],
    article: ArticleEntity[],
    articleMultilingualTextEntity: MultilingualTextEntity[],
  ) {
    return plainToInstance(this, {
      banner: banner.map((v) => v.getImage()),
      section: section.map((v) =>
        GetHomeSection.from(v, sectionMultilingualTextEntity),
      ),
      news: news.map((v) => GetHomeNews.from(v, newsMultilingualTextEntity)),
      article: article.map((v) =>
        GetHomeArticle.from(v, articleMultilingualTextEntity),
      ),
    });
  }
}

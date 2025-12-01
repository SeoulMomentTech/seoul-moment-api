/* eslint-disable max-lines-per-function */
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { NewsSectionEntity } from '@app/repository/entity/news-section.entity';
import { NewsEntity } from '@app/repository/entity/news.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import { IsDefined, IsNumber } from 'class-validator';

import { MultilingualFieldDto } from '../dto/multilingual.dto';

export class GetLastNews {
  @ApiProperty({ description: '뉴스 ID', example: 1 })
  id: number;

  @ApiProperty({
    description: '배너 이미지 URL',
    example: 'https://example.com/banner.jpg',
  })
  banner: string;

  @ApiProperty({ description: '뉴스 제목', example: '서울모먼트 신제품 출시' })
  title: string;

  static from(
    entity: NewsEntity,
    multilingualText: MultilingualTextEntity[],
    language: LanguageCode,
  ) {
    multilingualText = multilingualText.filter((v) => v.entityId === entity.id);

    const title = new MultilingualFieldDto(
      multilingualText
        .filter((v) => v.fieldName === 'title')
        .map((text) => ({
          language: text.language.code,
          content: text.textContent,
        })),
    );

    return plainToInstance(this, {
      id: entity.id,
      banner: entity.getBannerImage(),
      title: title.getContentByLanguage(language),
    });
  }
}

export class GetNewsSection {
  @ApiProperty({ description: '섹션 제목', example: '새로운 소식' })
  title: string;

  @ApiProperty({
    description: '섹션 부제목',
    example: '서울모먼트의 최신 뉴스',
  })
  subTitle: string;

  @ApiProperty({
    description: '섹션 내용',
    example: '서울모먼트의 새로운 소식을 전해드립니다...',
  })
  content: string;

  @ApiProperty({
    description: '섹션 이미지 URL 리스트',
    example: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ],
    type: [String],
  })
  imageList: string[];

  static from(
    entity: NewsSectionEntity,
    multilingualText: MultilingualTextEntity[],
    language: LanguageCode,
  ) {
    multilingualText = multilingualText.filter((v) => v.entityId === entity.id);

    const title = new MultilingualFieldDto(
      multilingualText
        .filter((v) => v.fieldName === 'title')
        .map((text) => ({
          language: text.language.code,
          content: text.textContent,
        })),
    );
    const subTitle = new MultilingualFieldDto(
      multilingualText
        .filter((v) => v.fieldName === 'subTitle')
        .map((text) => ({
          language: text.language.code,
          content: text.textContent,
        })),
    );
    const content = new MultilingualFieldDto(
      multilingualText
        .filter((v) => v.fieldName === 'content')
        .map((text) => ({
          language: text.language.code,
          content: text.textContent,
        })),
    );

    return plainToInstance(this, {
      title: title.getContentByLanguage(language),
      subTitle: subTitle.getContentByLanguage(language),
      content: content.getContentByLanguage(language),
      imageList: entity.sectionImage
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((v) => v.getImage()),
    });
  }
}

export class GetNewsResponse {
  @ApiProperty({ description: '뉴스 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '카테고리 ID', example: 1 })
  categoryId: number;

  @ApiPropertyOptional({ description: '브랜드 ID', example: 1 })
  brandId?: number;

  @ApiProperty({ description: '작성자 이름', example: '김서울' })
  writer: string;

  @ApiProperty({
    description: '작성 일시',
    example: '2025-09-03T01:20:45.123Z',
  })
  createDate: Date;

  @ApiProperty({ description: '카테고리 이름', example: '브랜드 뉴스' })
  category: string;

  @ApiProperty({ description: '뉴스 제목', example: '서울모먼트 신제품 출시' })
  title: string;

  @ApiProperty({
    description: '뉴스 내용',
    example: '서울모먼트의 새로운 제품이 출시되었습니다...',
  })
  content: string;

  @ApiProperty({
    description: '배너 이미지 URL',
    example: 'https://example.com/banner.jpg',
  })
  banner: string;

  @ApiProperty({
    description: '프로필 이미지 URL',
    example: 'https://example.com/profile.jpg',
  })
  profileImage: string;

  @ApiProperty({ description: '최신 뉴스 목록', type: [GetLastNews] })
  lastNews: GetLastNews[];

  @ApiProperty({ description: '뉴스 섹션 리스트', type: [GetNewsSection] })
  section: GetNewsSection[];

  static from(
    entity: NewsEntity,
    multilingualText: {
      text: MultilingualTextEntity[];
      sectionText: MultilingualTextEntity[];
    },
    lastNewsList: NewsEntity[],
    lastNewsMultilingual: MultilingualTextEntity[],
    categoryMultilingual: MultilingualTextEntity[],
    language: LanguageCode,
  ) {
    const title = new MultilingualFieldDto(
      multilingualText.text
        .filter((v) => v.fieldName === 'title')
        .map((text) => ({
          content: text.textContent,
          language: text.language.code,
        })),
    );

    const content = new MultilingualFieldDto(
      multilingualText.text
        .filter((v) => v.fieldName === 'content')
        .map((text) => ({
          content: text.textContent,
          language: text.language.code,
        })),
    );

    const categoryName = MultilingualFieldDto.fromByEntity(
      categoryMultilingual,
      'name',
    );

    return plainToInstance(this, {
      id: entity.id,
      brandId: entity.brand?.id,
      writer: entity.writer,
      createDate: entity.createDate,
      category: categoryName.getContent(),
      title: title.getContentByLanguage(language),
      content: content.getContentByLanguage(language),
      banner: entity.getBannerImage(),
      profileImage: entity.getProfileImage(),
      lastNews: lastNewsList.map((v) =>
        GetLastNews.from(v, lastNewsMultilingual, language),
      ),
      section: entity.section.map((v) =>
        GetNewsSection.from(v, multilingualText.sectionText, language),
      ),
    });
  }
}

export class GetNewsListResponse {
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

export class GetNewsListRequest {
  @ApiProperty({
    description: 'list 갯수',
    example: 3,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  count: number;
}

/* eslint-disable max-lines-per-function */
import { ArticleSectionEntity } from '@app/repository/entity/article-section.entity';
import { ArticleEntity } from '@app/repository/entity/article.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

import { MultilingualFieldDto } from '../dto/multilingual.dto';

export class GetLastArticle {
  @ApiProperty({ description: '아티클 ID', example: 1 })
  id: number;

  @ApiProperty({
    description: '배너 이미지 URL',
    example: 'https://example.com/banner.jpg',
  })
  banner: string;

  @ApiProperty({ description: '아티클 제목', example: '서울의 특별한 순간들' })
  title: string;

  static from(
    entity: ArticleEntity,
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

export class GetArticleSection {
  @ApiProperty({ description: '섹션 제목', example: '브랜드 스토리' })
  title: string;

  @ApiProperty({ description: '섹션 부제목', example: '서울모먼트의 시작' })
  subTitle: string;

  @ApiProperty({
    description: '섹션 내용',
    example: '서울모먼트는 서울의 특별한 순간들을 담은 브랜드입니다...',
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
  iamgeList: string[];

  static from(
    entity: ArticleSectionEntity,
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
      iamgeList: entity.sectionImage
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((v) => v.getImage()),
    });
  }
}

export class GetArticleResponse {
  @ApiProperty({ description: '아티클 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '브랜드 ID', example: 1 })
  brandId: number;

  @ApiProperty({ description: '작성자 이름', example: '김서울' })
  writer: string;

  @ApiProperty({
    description: '작성 일시',
    example: '2025-09-03T01:20:45.123Z',
  })
  createDate: Date;

  @ApiProperty({ description: '카테고리 이름', example: '문화' })
  category: string;

  @ApiProperty({ description: '아티클 제목', example: '서울의 특별한 순간들' })
  title: string;

  @ApiProperty({
    description: '아티클 내용',
    example: '서울모먼트는 서울의 특별한 순간들을 담은 브랜드입니다...',
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

  @ApiProperty({ description: '최신 아티클 목록', type: [GetLastArticle] })
  lastArticle: GetLastArticle[];

  @ApiProperty({ description: '아티클 섹션 리스트', type: [GetArticleSection] })
  section: GetArticleSection;

  static from(
    entity: ArticleEntity,
    multilingualText: {
      text: MultilingualTextEntity[];
      sectionText: MultilingualTextEntity[];
    },
    lastArticleList: ArticleEntity[],
    lastArticleMultilingual: MultilingualTextEntity[],
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
      brandId: entity.brand.id,
      writer: entity.writer,
      createDate: entity.createDate,
      category: categoryName.getContent(),
      title: title.getContentByLanguage(language),
      content: content.getContentByLanguage(language),
      banner: entity.getBannerImage(),
      profileImage: entity.getProfileImage(),
      lastArticle: lastArticleList.map((v) =>
        GetLastArticle.from(v, lastArticleMultilingual, language),
      ),
      section: entity.section.map((v) =>
        GetArticleSection.from(v, multilingualText.sectionText, language),
      ),
    });
  }
}

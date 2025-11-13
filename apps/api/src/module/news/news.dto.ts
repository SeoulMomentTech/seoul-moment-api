/* eslint-disable max-lines-per-function */
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { NewsSectionEntity } from '@app/repository/entity/news-section.entity';
import { NewsEntity } from '@app/repository/entity/news.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

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

export class PostNewsInfo {
  @ApiProperty({
    description: '언어 ID',
    example: 1,
  })
  @IsInt()
  @IsDefined()
  languageId: number;

  @ApiProperty({
    description: '뉴스 타이틀',
    example: '서울모먼트 신제품 출시',
  })
  @IsString()
  @IsDefined()
  title: string;

  @ApiProperty({
    description: '뉴스 컨텐츠',
    example: '서울모먼트의 새로운 제품이 출시되었습니다...',
  })
  @IsString()
  @IsDefined()
  content: string;
}

export class PostNewsSectionInfo {
  @ApiProperty({
    description: '언어 ID',
    example: 1,
  })
  @IsInt()
  @IsDefined()
  languageId: number;

  @ApiProperty({
    description: '섹션 제목',
    example: '뉴스 스토리',
  })
  @IsString()
  @IsDefined()
  title: string;

  @ApiProperty({
    description: '섹션 서브 타이틀',
    example: '뉴스 스토리 서브',
  })
  @IsString()
  @IsDefined()
  subTitle: string;

  @ApiProperty({
    description: '섹션 내용',
    example:
      '서울모먼트는 2020년 설립된 라이프스타일 브랜드로, 서울의 특별한 순간들을 제품에 담아내고 있습니다.',
  })
  @IsString()
  @IsDefined()
  content: string;
}

export class PostNewsSection {
  @ApiProperty({
    description: '다국어 섹션 정보 리스트 (한국어, 영어, 중국어)',
    type: [PostNewsSectionInfo],
    example: [
      {
        languageId: 1,
        title: '브랜드 CEO 이름 스토리',
        subTitle:
          'Chwi의 향은 부담스럽지 않고 은은한 자연의 향을 표현하기 위해 전문 조향 기술을 사용합니다.',
        content: `히어리 세라믹 작가 김은지라고 합니다.”라고 해요. 2016년부터 히어리 세라믹을 통해
                      작업을 이어오는 동안 제 작업을 좋아해주시는 분들도 늘었고 그만큼 자부심도 갖게 되어
                      어느덧 작가라 불리는 것이 자연스러워졌습니다.

                      도예를 전공한 대학 시절부터 유연한 형태를 좋아했어요. 졸업작품을 준비하면서 틀에
                      잡히지 않는 모양을 많이 만들었죠. 이런 점을 남들과 다른 특색으로 살리려 했어요.
                      유약 사용을 최소화 하며 흙의 질감을 돋보이게 했고, 그릇이 그리는 선을 중요하게
                      생각해 최대한 얇게 만들었어요. 색상도 옅게 나왔죠. 

                      이러한 과정에서 비로소 히어리 세라믹만의 캐릭터를 찾아낸 것 같아요. 
                      지금도 최대한 얇게 만들며 색다른 선을 보여주는 작업을 이어가고 있습니다.`,
      },
      {
        languageId: 2,
        title: 'Brand CEO Name',
        subTitle:
          'Chwi employs professional perfumery techniques to express a subtle, natural fragrance that is never overpowering.',
        content: `My name is Kim Eun-ji, a ceramic artist at Hearie Ceramics. Since 2016, while continuing my work through Hearie Ceramics, the number of people who appreciate my work has grown, and with that, I've gained a sense of pride. Before I knew it, being called an artist felt natural.

                      Ever since my university days majoring in ceramics, I've loved flexible forms. While preparing my graduation piece, I created many unconventional shapes. I aimed to make this my unique characteristic.
                      I minimized glaze use to highlight the clay's texture and prioritized the lines drawn by the vessel,
                      making them as thin as possible. The colors also came out faint.

                      It was through this process that I finally found the character unique to Heary Ceramics.
                      Even now, I continue creating work that pushes for maximum thinness and reveals distinctive lines.`,
      },
      {
        languageId: 3,
        title: '品牌執行長姓名',
        subTitle:
          'Chwi的香氣採用專業調香技術，旨在呈現不顯厚重、自然淡雅的芬芳。',
        content: `我是Heary Ceramic的陶藝家金恩智。自2016年透過Heary Ceramic持續創作以來，喜愛我作品的人逐漸增加，也因此培養出相應的自豪感，不知不覺間被稱為藝術家已變得自然而然。

                      自大學主修陶藝時期起，便鍾情於流暢的形態。籌備畢業作品時，
                      創作了許多跳脫框架的造型。我試圖將這份特質轉化為與眾不同的藝術特色。
                      我極力減少釉料使用以凸顯陶土質感，並重視器皿勾勒的線條，
                      追求極致纖薄的器身，色澤亦呈現淡雅韻致。

                      正是這段歷程，讓我終於找到Heary Ceramic獨有的風格特質。
                      至今我仍持續以極致薄胎技法，探索展現嶄新線條的創作可能性。`,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostNewsSectionInfo)
  @IsDefined()
  textList: PostNewsSectionInfo[];

  @ApiProperty({
    description: 'S3 업로드 후 뉴스 섹션 이미지 경로',
    example: [
      '/news-section/2025-09-16/seoul-moment-news.jpg',
      '/news-section/2025-09-16/seoul-moment-news.jpg',
      '/news-section/2025-09-16/seoul-moment-news.jpg',
    ],
  })
  @IsArray()
  @IsDefined()
  imageUrlList: string[];
}

export class PostNewsRequest {
  @ApiProperty({
    description: '카테고리 id',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  categoryId: number;

  @ApiPropertyOptional({
    description: '브랜드 id',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  brandId: number;

  @ApiProperty({
    description: '뉴스 국가별 object list',
    type: [PostNewsInfo],
    example: [
      {
        languageId: 1,
        title: '뉴스입니다',
        content: '요약 내용입니다.',
      },
      {
        languageId: 2,
        title: 'This is the news.',
        content: 'Summary content.',
      },
      {
        languageId: 3,
        title: '新聞報導',
        content: '以下為摘要內容。',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostNewsInfo)
  @IsDefined()
  list: PostNewsInfo[];

  @ApiProperty({
    description: '뉴스 섹션 리스트',
    type: [PostNewsSection],
    example: [
      {
        textList: [
          {
            languageId: 1,
            title: '브랜드 CEO 이름 스토리',
            subTitle:
              'Chwi의 향은 부담스럽지 않고 은은한 자연의 향을 표현하기 위해 전문 조향 기술을 사용합니다.',
            content: `히어리 세라믹 작가 김은지라고 합니다.”라고 해요. 2016년부터 히어리 세라믹을 통해
                      작업을 이어오는 동안 제 작업을 좋아해주시는 분들도 늘었고 그만큼 자부심도 갖게 되어
                      어느덧 작가라 불리는 것이 자연스러워졌습니다.

                      도예를 전공한 대학 시절부터 유연한 형태를 좋아했어요. 졸업작품을 준비하면서 틀에
                      잡히지 않는 모양을 많이 만들었죠. 이런 점을 남들과 다른 특색으로 살리려 했어요.
                      유약 사용을 최소화 하며 흙의 질감을 돋보이게 했고, 그릇이 그리는 선을 중요하게
                      생각해 최대한 얇게 만들었어요. 색상도 옅게 나왔죠. 

                      이러한 과정에서 비로소 히어리 세라믹만의 캐릭터를 찾아낸 것 같아요. 
                      지금도 최대한 얇게 만들며 색다른 선을 보여주는 작업을 이어가고 있습니다.`,
          },
          {
            languageId: 2,
            title: 'Brand CEO Name',
            subTitle:
              'Chwi employs professional perfumery techniques to express a subtle, natural fragrance that is never overpowering.',
            content: `My name is Kim Eun-ji, a ceramic artist at Hearie Ceramics. Since 2016, while continuing my work through Hearie Ceramics, the number of people who appreciate my work has grown, and with that, I've gained a sense of pride. Before I knew it, being called an artist felt natural.

                      Ever since my university days majoring in ceramics, I've loved flexible forms. While preparing my graduation piece, I created many unconventional shapes. I aimed to make this my unique characteristic.
                      I minimized glaze use to highlight the clay's texture and prioritized the lines drawn by the vessel,
                      making them as thin as possible. The colors also came out faint.

                      It was through this process that I finally found the character unique to Heary Ceramics.
                      Even now, I continue creating work that pushes for maximum thinness and reveals distinctive lines.`,
          },
          {
            languageId: 3,
            title: '品牌執行長姓名',
            subTitle:
              'Chwi的香氣採用專業調香技術，旨在呈現不顯厚重、自然淡雅的芬芳。',
            content: `我是Heary Ceramic的陶藝家金恩智。自2016年透過Heary Ceramic持續創作以來，喜愛我作品的人逐漸增加，也因此培養出相應的自豪感，不知不覺間被稱為藝術家已變得自然而然。

                      自大學主修陶藝時期起，便鍾情於流暢的形態。籌備畢業作品時，
                      創作了許多跳脫框架的造型。我試圖將這份特質轉化為與眾不同的藝術特色。
                      我極力減少釉料使用以凸顯陶土質感，並重視器皿勾勒的線條，
                      追求極致纖薄的器身，色澤亦呈現淡雅韻致。

                      正是這段歷程，讓我終於找到Heary Ceramic獨有的風格特質。
                      至今我仍持續以極致薄胎技法，探索展現嶄新線條的創作可能性。`,
          },
        ],
        imageUrlList: [
          '/news_section/2025-09-16/seoul-moment-profile.jpg',
          '/news_section/2025-09-16/seoul-moment-profile.jpg',
          '/news_section/2025-09-16/seoul-moment-profile.jpg',
        ],
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostNewsSection)
  @IsDefined()
  sectionList: PostNewsSection[];

  @ApiProperty({
    description: '기자명',
    example: '장원영',
  })
  @IsString()
  @IsDefined()
  writer: string;

  @ApiProperty({
    description: '뉴스 배너',
    example: '/news/2025-09-16/seoul-moment-profile.jpg',
  })
  @IsString()
  @IsDefined()
  banner: string;

  @ApiProperty({
    description: '기자 프로필',
    example: '/news/2025-09-16/seoul-moment-profile.jpg',
  })
  @IsString()
  @IsDefined()
  profile: string;
}

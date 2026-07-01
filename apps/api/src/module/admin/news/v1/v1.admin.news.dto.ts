import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { NewsEntity } from '@app/repository/entity/news.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import {
  GetAdminNewsInfoText,
  PostAdminNewsInfo,
  PostAdminNewsSection,
} from '../admin.news.dto';

export class V1GetAdminNewsInfoResponse {
  @ApiProperty({
    description: '뉴스 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '뉴스 카테고리 ID',
    example: 1,
  })
  newsCategoryId: number;

  @ApiProperty({ description: '카테고리 ID', example: 1 })
  categoryId: number;

  @ApiPropertyOptional({ description: '브랜드 ID', example: 1 })
  brandId?: number;

  @ApiProperty({ description: '작성자 이름', example: '김서울' })
  writer: string;

  @ApiProperty({
    description: '배너 이미지 URL',
    example: 'https://example.com/banner.jpg',
  })
  banner: string;

  @ApiProperty({
    description: '작성자 프로필 이미지 URL',
    example: 'https://example.com/profile.jpg',
  })
  profile: string;

  @ApiProperty({
    description: '홈 이미지 URL',
    example: 'https://example.com/home.jpg',
  })
  homeImage: string;

  @ApiProperty({
    description: '다국어 브랜드 정보 리스트 (한국어, 영어, 중국어)',
    example: [
      {
        languageId: 1,
        title: '뉴스 제목',
        content: '뉴스 내용',
        section: [
          {
            id: 1,
            title: '뉴스 섹션 제목',
            subTitle: '뉴스 섹션 서브 제목',
            content: '뉴스 섹션 내용',
            imageList: [
              'https://image-dev.seoulmoment.com.tw/news-sections/2025-09-16/section-story-01.jpg',
              'https://image-dev.seoulmoment.com.tw/news-sections/2025-09-16/section-story-02.jpg',
            ],
          },
        ],
      },
      {
        languageId: 2,
        title: 'News title',
        content: 'News content',
        section: [
          {
            id: 1,
            title: 'News Section title',
            subTitle: 'News Section sub title',
            content: 'News Section content',
            imageList: [
              'https://image-dev.seoulmoment.com.tw/news-sections/2025-09-16/section-story-01.jpg',
              'https://image-dev.seoulmoment.com.tw/news-sections/2025-09-16/section-story-02.jpg',
            ],
          },
        ],
      },
      {
        languageId: 3,
        title: '首爾時刻',
        content: '捕捉首爾特殊時刻的生活方式品牌。',
        section: [
          {
            id: 1,
            title: '品牌故事',
            subTitle: '品牌故事 副標題',
            content:
              '首爾時刻是2020年成立的生活方式品牌，透過產品捕捉首爾的特殊時刻。',
            imageList: [
              'https://image-dev.seoulmoment.com.tw/news-sections/2025-09-16/section-story-01.jpg',
              'https://image-dev.seoulmoment.com.tw/news-sections/2025-09-16/section-story-02.jpg',
            ],
          },
        ],
      },
    ],
  })
  multilingualTextList: GetAdminNewsInfoText[];

  static from(
    entity: NewsEntity,
    multilingualText: {
      languageId: number;
      newsText: MultilingualTextEntity[];
      sectionText: MultilingualTextEntity[];
    }[],
  ) {
    const multilingualTextList: GetAdminNewsInfoText[] = [];

    for (const text of multilingualText) {
      multilingualTextList.push(GetAdminNewsInfoText.from(entity, text));
    }

    return plainToInstance(this, {
      id: entity.id,
      newsCategoryId: entity.newsCategoryId,
      banner: entity.getBannerImage(),
      profile: entity.getProfileImage(),
      homeImage: entity.getHomeImage(),
      writer: entity.writer,
      categoryId: entity.categoryId,
      brandId: entity.brandId,
      multilingualTextList,
    });
  }
}

export class V1PostAdminNewsRequest {
  @ApiProperty({
    description: '뉴스 카테고리 ID',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  newsCategoryId: number;

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
  brandId?: number;

  @ApiProperty({
    description: '뉴스 국가별 object list',
    type: [PostAdminNewsInfo],
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
  @Type(() => PostAdminNewsInfo)
  @IsDefined()
  list: PostAdminNewsInfo[];

  @ApiProperty({
    description: '뉴스 섹션 리스트',
    type: [PostAdminNewsSection],
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
  @Type(() => PostAdminNewsSection)
  @IsDefined()
  sectionList: PostAdminNewsSection[];

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

  @ApiProperty({
    description: '홈 이미지 URL',
    example: '/news/2025-09-16/seoul-moment-home.jpg',
  })
  @IsString()
  @IsDefined()
  homeImage: string;
}

export class V1UpdateAdminNewsRequest {
  @ApiProperty({
    description: '뉴스 카테고리 ID',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  newsCategoryId?: number;

  @ApiPropertyOptional({ description: '카테고리 ID', example: 1 })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  categoryId?: number;

  @ApiPropertyOptional({ description: '브랜드 ID', example: 1 })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  brandId?: number;

  @ApiPropertyOptional({ description: '작성자 이름', example: '김서울' })
  @IsString()
  @IsOptional()
  writer?: string;

  @ApiPropertyOptional({
    description: '배너 이미지 URL',
    example: 'https://example.com/banner.jpg',
  })
  @IsString()
  @IsOptional()
  banner?: string;

  @ApiPropertyOptional({
    description: '작성자 프로필 이미지 URL',
    example: 'https://example.com/profile.jpg',
  })
  @IsString()
  @IsOptional()
  profile?: string;

  @ApiPropertyOptional({
    description: '홈 이미지 URL',
    example: 'https://example.com/home.jpg',
  })
  @IsString()
  @IsOptional()
  homeImage?: string;

  @ApiPropertyOptional({
    description: '다국어 브랜드 정보 리스트 (한국어, 영어, 중국어)',
    example: [
      {
        languageId: 1,
        title: '뉴스 제목',
        content: '뉴스 내용',
        section: [
          {
            id: 1,
            title: '뉴스 섹션 제목',
            subTitle: '뉴스 섹션 서브 제목',
            content: '뉴스 섹션 내용',
            imageList: [
              'https://image-dev.seoulmoment.com.tw/news-sections/2025-09-16/section-story-01.jpg',
              'https://image-dev.seoulmoment.com.tw/news-sections/2025-09-16/section-story-02.jpg',
            ],
          },
        ],
      },
      {
        languageId: 2,
        title: 'News title',
        content: 'A lifestyle brand that captures special moments in Seoul.',
        section: [
          {
            id: 1,
            title: 'News Section title',
            subTitle: 'News Section sub title',
            content:
              'Seoul Moment is a lifestyle brand established in 2020, capturing special moments in Seoul through our products.',
            imageList: [
              'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-story-01.jpg',
              'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-story-02.jpg',
            ],
          },
        ],
      },
      {
        languageId: 3,
        title: '首爾時刻',
        content: '捕捉首爾特殊时的生活方式品牌。',
        section: [
          {
            id: 1,
            title: 'News Section title',
            subTitle: 'News Section sub title',
            content:
              '首爾時刻是2020年成立的生活方式品牌，透過產品捕捉首爾的特殊時刻。',
            imageList: [
              'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-story-01.jpg',
              'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-story-02.jpg',
            ],
          },
        ],
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminNewsInfoText)
  @IsOptional()
  multilingualTextList?: GetAdminNewsInfoText[];
}

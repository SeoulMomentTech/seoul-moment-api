import { ArticleSectionEntity } from '@app/repository/entity/article-section.entity';
import { ArticleEntity } from '@app/repository/entity/article.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { ArticleSearchEnum } from '@app/repository/enum/article.repository.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsOptional,
  IsEnum,
  IsNumber,
  IsDefined,
  ValidateNested,
  IsArray,
  IsInt,
  IsString,
} from 'class-validator';

import { MultilingualFieldDto } from '../../dto/multilingual.dto';
import { ListFilterDto } from '../admin.dto';

export class UpdateAdminArticleImage {
  @ApiProperty({
    description: '기존 배너 이미지 URL',
    example: '/article/2025-09-16/seoul-moment-banner-01.jpg',
  })
  @IsString()
  @IsDefined()
  oldImageUrl: string;

  @ApiProperty({
    description: '바뀔 아티클 이미지 URL',
    example:
      'https://image-dev.seoulmoment.com.tw/article/2025-09-16/seoul-moment-banner-01-new.jpg',
  })
  @IsString()
  @IsDefined()
  newImageUrl: string;
}

export class AdminArticleListRequest extends ListFilterDto {
  @ApiPropertyOptional({
    description: '검색 칼럼',
    example: ArticleSearchEnum.TITLE,
    enum: ArticleSearchEnum,
  })
  @IsOptional()
  @IsEnum(ArticleSearchEnum)
  searchColumn: ArticleSearchEnum;
}

export class GetAdminArticleTextDto {
  @ApiProperty({
    description: '언어 코드',
    example: LanguageCode.KOREAN,
  })
  languageCode: LanguageCode;

  @ApiProperty({
    description: '아티클 제목',
    example: 'Seoul Moment Article Launch',
  })
  title: string;

  @ApiProperty({
    description: '아티클 내용',
    example: 'Seoul Moment Article Launch',
  })
  content: string;

  static from(languageCode: LanguageCode, title: string, content: string) {
    return plainToInstance(this, {
      languageCode,
      title,
      content,
    });
  }
}

export class GetAdminArticleResponse {
  @ApiProperty({
    description: '아티클 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '아티클 텍스트 리스트',
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        title: '서울모먼트 아티클',
        content: '서울모먼트 아티클 내용',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        title: 'Seoul Moment Article',
        content: 'Seoul Moment Article content',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        title: '首爾時刻아티클',
        content: '首爾時刻아티클 내용',
      },
    ],
    type: [GetAdminArticleTextDto],
  })
  textDto: GetAdminArticleTextDto[];

  @ApiProperty({
    description: '생성일',
    example: '2025-01-01T12:00:00.000Z',
  })
  createDate: Date;

  @ApiProperty({
    description: '수정일',
    example: '2025-01-01T12:00:00.000Z',
  })
  updateDate: Date;

  static from(entity: ArticleEntity, textDto: GetAdminArticleTextDto[]) {
    return plainToInstance(this, {
      id: entity.id,
      textDto,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

export class PostAdminArticleInfo {
  @ApiProperty({
    description: '언어 ID',
    example: 1,
  })
  @IsInt()
  @IsDefined()
  languageId: number;

  @ApiProperty({
    description: '아티클 타이틀',
    example: '서울모먼트 새로운 아티클',
  })
  @IsString()
  @IsDefined()
  title: string;

  @ApiProperty({
    description: '아티클 컨텐츠',
    example: '서울모먼트의 새로운 아티클을 전해드립니다...',
  })
  @IsString()
  @IsDefined()
  content: string;
}

export class PostAdminArticleSectionInfo {
  @ApiProperty({
    description: '언어 ID',
    example: 1,
  })
  @IsInt()
  @IsDefined()
  languageId: number;

  @ApiProperty({
    description: '섹션 제목',
    example: '아티클 스토리',
  })
  @IsString()
  @IsDefined()
  title: string;

  @ApiProperty({
    description: '섹션 서브 타이틀',
    example: '아티클 스토리 서브',
  })
  @IsString()
  @IsDefined()
  subTitle: string;

  @ApiProperty({
    description: '섹션 내용',
    example:
      '서울모먼트는 2020년 설립된 라이프스타일 아티클로, 서울의 특별한 순간들을 제품에 담아내고 있습니다.',
  })
  @IsString()
  @IsDefined()
  content: string;
}

export class PostAdminArticleSection {
  @ApiProperty({
    description: '다국어 섹션 정보 리스트 (한국어, 영어, 중국어)',
    type: [PostAdminArticleSectionInfo],
    example: [
      {
        languageId: 1,
        title: '아티클 CEO 이름 스토리',
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
        title: 'Article CEO Name',
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
  @Type(() => PostAdminArticleSectionInfo)
  @IsDefined()
  textList: PostAdminArticleSectionInfo[];

  @ApiProperty({
    description: 'S3 업로드 후 아티클 섹션 이미지 경로',
    example: [
      '/article-section/2025-09-16/seoul-moment-article.jpg',
      '/article-section/2025-09-16/seoul-moment-article.jpg',
    ],
  })
  @IsArray()
  @IsDefined()
  imageUrlList: string[];
}

export class PostAdminArticleRequest {
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
    description: '아티클 국가별 object list',
    type: [PostAdminArticleInfo],
    example: [
      {
        languageId: 1,
        title: '아티클입니다',
        content: '요약 내용입니다.',
      },
      {
        languageId: 2,
        title: 'This is the article.',
        content: 'Summary content.',
      },
      {
        languageId: 3,
        title: '아티클 보도',
        content: '以下為摘要內容。',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminArticleInfo)
  @IsDefined()
  list: PostAdminArticleInfo[];

  @ApiProperty({
    description: '아티클 섹션 리스트',
    type: [PostAdminArticleSection],
    example: [
      {
        textList: [
          {
            languageId: 1,
            title: '아티클 CEO 이름 스토리',
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
            title: 'Article CEO Name',
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
          '/article_section/2025-09-16/seoul-moment-profile.jpg',
          '/article_section/2025-09-16/seoul-moment-profile.jpg',
        ],
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminArticleSection)
  @IsDefined()
  sectionList: PostAdminArticleSection[];

  @ApiProperty({
    description: '기자명',
    example: '장원영',
  })
  @IsString()
  @IsDefined()
  writer: string;

  @ApiProperty({
    description: '아티클 배너',
    example: '/article/2025-09-16/seoul-moment-profile.jpg',
  })
  @IsString()
  @IsDefined()
  banner: string;

  @ApiProperty({
    description: '기자 프로필',
    example: '/article/2025-09-16/seoul-moment-profile.jpg',
  })
  @IsString()
  @IsDefined()
  profile: string;

  @ApiProperty({
    description: '홈 이미지 URL',
    example: '/article/2025-09-16/seoul-moment-home.jpg',
  })
  @IsString()
  @IsDefined()
  homeImage: string;
}

export class UpdateAdminArticleSection {
  @ApiProperty({ description: '섹션 ID', example: 1 })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  id: number;

  @ApiPropertyOptional({ description: '섹션 제목', example: '새로운 아티클' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: '섹션 부제목',
    example: '서울모먼트의 새로운 아티클',
  })
  @IsString()
  @IsOptional()
  subTitle?: string;

  @ApiPropertyOptional({
    description: '섹션 내용',
    example: '서울모먼트의 새로운 아티클을 전해드립니다...',
  })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({
    description: '섹션 이미지 리스트',
    type: [UpdateAdminArticleImage],
    example: [
      {
        oldImageUrl: '/article-sections/2025-09-16/section-story-01.jpg',
        newImageUrl:
          'https://image-dev.seoulmoment.com.tw/article-sections/2025-09-16/section-story-01-new.jpg',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAdminArticleImage)
  @IsOptional()
  sectionImageList?: UpdateAdminArticleImage[];
}

export class GetAdminArticleSection {
  @ApiProperty({ description: '섹션 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '섹션 제목', example: '새로운 아티클' })
  title: string;

  @ApiProperty({
    description: '섹션 부제목',
    example: '서울모먼트의 새로운 아티클',
  })
  subTitle: string;

  @ApiProperty({
    description: '섹션 내용',
    example: '서울모먼트의 새로운 아티클을 전해드립니다...',
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
    entity: ArticleSectionEntity,
    multilingualText: MultilingualTextEntity[],
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
      id: entity.id,
      title: title.getContent(),
      subTitle: subTitle.getContent(),
      content: content.getContent(),
      imageList: entity.sectionImage
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((v) => v.getImage()),
    });
  }
}

export class UpdateAdminArticleInfoText {
  @ApiProperty({
    description: '언어 ID',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  languageId: number;

  @ApiPropertyOptional({
    description: '아티클 제목',
    example: '서울모먼트 신제품 출시',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: '아티클 내용',
    example: '서울모먼트의 새로운 제품이 출시되었습니다...',
  })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({
    description: '아티클 정보 섹션 리스트',
    type: [UpdateAdminArticleSection],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAdminArticleSection)
  @IsOptional()
  section?: UpdateAdminArticleSection[];
}

export class GetAdminArticleInfoText {
  @ApiProperty({
    description: '언어 ID',
    example: 1,
  })
  @IsInt()
  @IsDefined()
  languageId: number;

  @ApiProperty({
    description: '아티클 제목',
    example: '서울모먼트 신제품 출시',
  })
  title: string;

  @ApiProperty({
    description: '아티클 내용',
    example: '서울모먼트의 새로운 제품이 출시되었습니다...',
  })
  content: string;

  @ApiProperty({
    description: '아티클 정보 섹션 리스트',
    type: [GetAdminArticleSection],
  })
  section: GetAdminArticleSection[];

  static from(
    entity: ArticleEntity,
    multilingualText: {
      languageId: number;
      articleText: MultilingualTextEntity[];
      sectionText: MultilingualTextEntity[];
    },
  ) {
    const titleTexts = multilingualText.articleText.filter(
      (text) => text.fieldName === 'title',
    );
    const contentTexts = multilingualText.articleText.filter(
      (text) => text.fieldName === 'content',
    );

    const titleField = new MultilingualFieldDto(
      titleTexts.map((text) => ({
        language: text.language.code,
        content: text.textContent,
      })),
    );

    const contentField = new MultilingualFieldDto(
      contentTexts.map((text) => ({
        language: text.language.code,
        content: text.textContent,
      })),
    );

    return plainToInstance(this, {
      languageId: multilingualText.languageId,
      title: titleField.getContent(),
      content: contentField.getContent(),
      section: entity.section.map((section) =>
        GetAdminArticleSection.from(section, multilingualText.sectionText),
      ),
    });
  }
}

export class GetAdminArticleInfoResponse {
  @ApiProperty({
    description: '아티클 ID',
    example: 1,
  })
  id: number;

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
    description: '홈 이미지 URL',
    example: 'https://example.com/home.jpg',
  })
  homeImage: string;

  @ApiProperty({
    description: '작성자 프로필 이미지 URL',
    example: 'https://example.com/profile.jpg',
  })
  profile: string;

  @ApiProperty({
    description: '다국어 아티클 정보 리스트 (한국어, 영어, 중국어)',
    example: [
      {
        languageId: 1,
        title: '서울모먼트',
        content: '서울의 특별한 순간들을 담은 라이프스타일 아티클입니다.',
        section: [
          {
            id: 1,
            title: '아티클 스토리',
            subTitle: '서울모먼트',
            content:
              '서울모먼트는 2020년 설립된 라이프스타일 아티클로, 서울의 특별한 순간들을 제품에 담아내고 있습니다.',
            imageList: [
              'https://image-dev.seoulmoment.com.tw/article-sections/2025-09-16/section-story-01.jpg',
              'https://image-dev.seoulmoment.com.tw/article-sections/2025-09-16/section-story-02.jpg',
            ],
          },
        ],
      },
      {
        languageId: 2,
        title: 'Seoul Moment',
        content: 'A lifestyle article that captures special moments in Seoul.',
        section: [
          {
            id: 1,
            title: 'Article Story',
            subTitle: 'Seoul Moment',
            content:
              'Seoul Moment is a article established in 2020, capturing special moments in Seoul through our products.',
            imageList: [
              'https://image-dev.seoulmoment.com.tw/article-sections/2025-09-16/section-story-01.jpg',
              'https://image-dev.seoulmoment.com.tw/article-sections/2025-09-16/section-story-02.jpg',
            ],
          },
        ],
      },
      {
        languageId: 3,
        title: '首爾時刻',
        content: '捕捉首爾特殊時刻的生活方式아티클。',
        section: [
          {
            id: 1,
            title: '아티클 스토리',
            subTitle: '首爾時刻',
            content:
              '首爾時刻是2020年成立的生活方式아티클，透過產品捕捉首爾的特殊時刻。',
            imageList: [
              'https://image-dev.seoulmoment.com.tw/article-sections/2025-09-16/section-story-01.jpg',
              'https://image-dev.seoulmoment.com.tw/article-sections/2025-09-16/section-story-02.jpg',
            ],
          },
        ],
      },
    ],
  })
  multilingualTextList: GetAdminArticleInfoText[];

  static from(
    entity: ArticleEntity,
    multilingualText: {
      languageId: number;
      articleText: MultilingualTextEntity[];
      sectionText: MultilingualTextEntity[];
    }[],
  ) {
    const multilingualTextList: GetAdminArticleInfoText[] = [];

    for (const text of multilingualText) {
      multilingualTextList.push(GetAdminArticleInfoText.from(entity, text));
    }

    return plainToInstance(this, {
      id: entity.id,
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

export class UpdateAdminArticleRequest {
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
    description: '다국어 아티클 정보 리스트 (한국어, 영어, 중국어)',
    type: [UpdateAdminArticleInfoText],
    example: [
      {
        languageId: 2,
        title: 'Seoul Moment Article',
        content:
          'Seoul Moment is a article that captures special moments in Seoul.',
        section: [
          {
            id: 1,
            title: 'Article Story',
            subTitle:
              'Seoul Moment is a article that captures special moments in Seoul.',
            content:
              'Seoul Moment is a article that captures special moments in Seoul.',
            sectionImageList: [
              {
                oldImageUrl:
                  '/article-sections/2025-09-16/section-story-01.jpg',
                newImageUrl:
                  'https://image-dev.seoulmoment.com.tw/article-sections/2025-09-16/section-story-01-new.jpg',
              },
            ],
          },
        ],
      },
      {
        languageId: 3,
        title: '首爾時刻아티클',
        content: '捕捉首爾特殊時刻的아티클。',
        section: [
          {
            id: 1,
            title: '品牌故事',
            subTitle: '首爾時刻아티클',
            content: '捕捉首爾特殊時刻的아티클。',
            sectionImageList: [
              {
                oldImageUrl:
                  '/article-sections/2025-09-16/section-story-01.jpg',
                newImageUrl:
                  'https://image-dev.seoulmoment.com.tw/article-sections/2025-09-16/section-story-01-new.jpg',
              },
            ],
          },
        ],
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAdminArticleInfoText)
  @IsOptional()
  multilingualTextList?: UpdateAdminArticleInfoText[];
}

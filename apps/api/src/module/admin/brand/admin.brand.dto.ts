import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class PostAdminBrandInfo {
  @ApiProperty({
    description: '언어 ID',
    example: 1,
  })
  @IsInt()
  @IsDefined()
  languageId: number;

  @ApiProperty({
    description: '브랜드 이름',
    example: '서울모먼트',
  })
  @IsString()
  @IsDefined()
  name: string;

  @ApiProperty({
    description: '브랜드 설명',
    example: '서울의 특별한 순간들을 담은 라이프스타일 브랜드입니다.',
  })
  @IsString()
  @IsDefined()
  description: string;
}
export class PostBrandSectionInfo {
  @ApiProperty({
    description: '언어 ID',
    example: 1,
  })
  @IsInt()
  @IsDefined()
  languageId: number;

  @ApiProperty({
    description: '섹션 제목',
    example: '브랜드 스토리',
  })
  @IsString()
  @IsDefined()
  title: string;

  @ApiProperty({
    description: '섹션 내용',
    example:
      '서울모먼트는 2020년 설립된 라이프스타일 브랜드로, 서울의 특별한 순간들을 제품에 담아내고 있습니다.',
  })
  @IsString()
  @IsDefined()
  content: string;
}

export class PostBrandSection {
  @ApiProperty({
    description: '다국어 섹션 정보 리스트 (한국어, 영어, 중국어)',
    type: [PostBrandSectionInfo],
    example: [
      {
        languageId: 1,
        title: '브랜드 스토리',
        content: '서울모먼트는 2020년 설립된 라이프스타일 브랜드입니다.',
      },
      {
        languageId: 2,
        title: 'Brand Story',
        content: 'Seoul Moment is a lifestyle brand established in 2020.',
      },
      {
        languageId: 3,
        title: '品牌故事',
        content: '首爾時刻是2020年成立的生活方式品牌。',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostBrandSectionInfo)
  @IsDefined()
  textList: PostBrandSectionInfo[];

  @ApiProperty({
    description: 'S3 업로드 후 섹션 이미지 이미지 경로',
    example: [
      '/brand-profiles/2025-09-16/seoul-moment-profile.jpg',
      '/brand-profiles/2025-09-16/seoul-moment-profile.jpg',
      '/brand-profiles/2025-09-16/seoul-moment-profile.jpg',
    ],
  })
  @IsArray()
  @IsDefined()
  imageUrlList: string[];
}

export class PostAdminBrandRequest {
  @ApiProperty({
    description: '다국어 브랜드 정보 리스트 (한국어, 영어, 중국어)',
    type: [PostAdminBrandInfo],
    example: [
      {
        languageId: 1,
        name: '서울모먼트',
        description: '서울의 특별한 순간들을 담은 라이프스타일 브랜드입니다.',
      },
      {
        languageId: 2,
        name: 'Seoul Moment',
        description:
          'A lifestyle brand that captures special moments in Seoul.',
      },
      {
        languageId: 3,
        name: '首爾時刻',
        description: '捕捉首爾特殊時刻的生活方式品牌。',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminBrandInfo)
  @IsDefined()
  textList: PostAdminBrandInfo[];

  @ApiProperty({
    description: '카테고리 ID',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  categoryId: number;

  @ApiPropertyOptional({
    description: 'S3 업로드 후 브랜드 프로필 이미지 경로',
    example: '/brand-profiles/2025-09-16/seoul-moment-profile.jpg',
  })
  @IsString()
  @IsOptional()
  profileImageUrl?: string;

  @ApiProperty({
    description: '브랜드 섹션 리스트 (브랜드 스토리, 연혁 등)',
    type: [PostBrandSection],
    example: [
      {
        textList: [
          {
            languageId: 1,
            title: '브랜드 스토리',
            content:
              '서울모먼트는 2020년 설립된 라이프스타일 브랜드로, 서울의 특별한 순간들을 제품에 담아내고 있습니다.',
          },
          {
            languageId: 2,
            title: 'Brand Story',
            content:
              'Seoul Moment is a lifestyle brand established in 2020, capturing special moments in Seoul through our products.',
          },
          {
            languageId: 3,
            title: '品牌故事',
            content:
              '首爾時刻是2020年成立的生活方式品牌，透過產品捕捉首爾的特殊時刻。',
          },
        ],
        imageUrlList: [
          '/brand-profiles/2025-09-16/seoul-moment-profile.jpg',
          '/brand-profiles/2025-09-16/seoul-moment-profile.jpg',
          '/brand-profiles/2025-09-16/seoul-moment-profile.jpg',
        ],
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostBrandSection)
  @IsDefined()
  sectionList: PostBrandSection[];

  @ApiProperty({
    description: 'S3 업로드 후 배너 이미지 경로',
    example: [
      '/brand-banners/2025-09-16/seoul-moment-banner-01.jpg',
      '/brand-banners/2025-09-16/seoul-moment-banner-02.jpg',
      '/brand-banners/2025-09-16/seoul-moment-banner-03.jpg',
    ],
  })
  @IsArray()
  @IsDefined()
  bannerImageUrlList: string[];

  @ApiProperty({
    description: 'S3 업로드 후 모바일 배너 이미지 경로',
    example: [
      '/brand-mobile-banners/2025-09-16/seoul-moment-mobile-banner-01.jpg',
      '/brand-mobile-banners/2025-09-16/seoul-moment-mobile-banner-02.jpg',
      '/brand-mobile-banners/2025-09-16/seoul-moment-mobile-banner-03.jpg',
    ],
  })
  @IsArray()
  @IsDefined()
  mobileBannerImageUrlList: string[];

  @ApiProperty({
    description: 'S3 업로드 후 배너 이미지 경로',
    example: '/brand-profiles/2025-09-16/seoul-moment-profile.jpg',
  })
  @IsString()
  @IsDefined()
  bannerImageUrl: string;

  @ApiProperty({
    description: '영어 브랜드 이름',
    example: 'Seoul Moment',
  })
  @IsString()
  @IsDefined()
  englishName: string;
}

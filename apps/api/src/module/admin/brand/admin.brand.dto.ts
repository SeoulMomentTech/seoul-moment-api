/* eslint-disable max-lines-per-function */
import { BrandSectionEntity } from '@app/repository/entity/brand-section.entity';
import { BrandEntity } from '@app/repository/entity/brand.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { BrandSearchEnum } from '@app/repository/enum/brand.repository.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { MultilingualFieldDto } from '../../dto/multilingual.dto';
import { ListFilterDto } from '../admin.dto';

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

export class GetAdminBrandInfoSection {
  @ApiProperty({
    description: '섹션 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '섹션 제목',
    example: '브랜드 스토리',
  })
  title: string;

  @ApiProperty({
    description: '섹션 내용',
    example:
      '서울모먼트는 2020년 설립된 라이프스타일 브랜드로, 서울의 특별한 순간들을 제품에 담아내고 있습니다.',
  })
  content: string;

  @ApiProperty({
    description: '섹션 이미지 URL 리스트',
    example: [
      'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-story-01.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-story-02.jpg',
    ],
    type: [String],
  })
  imageList: string[];

  static from(
    entity: BrandSectionEntity,
    multilingualText: MultilingualTextEntity[],
  ) {
    multilingualText = multilingualText.filter(
      (text) => text.entityId === entity.id,
    );

    const titleTexts = multilingualText.filter(
      (text) => text.fieldName === 'title',
    );
    const contentTexts = multilingualText.filter(
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
      id: entity.id,
      title: titleField.getContent(),
      content: contentField.getContent(),
      imageList: entity.sectionImage
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((v) => v.getImage()),
    });
  }
}
export class GetAdminBrandInfoText {
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
  name: string;

  @ApiProperty({
    description: '브랜드 설명',
    example:
      '서울의 특별한 순간들을 담은 라이프스타일 브랜드입니다. 한국의 전통미와 현대적 감각을 조화롭게 표현합니다.',
  })
  description: string;

  @ApiProperty({
    description: '브랜드 정보 섹션 리스트',
    type: [GetAdminBrandInfoSection],
  })
  section: GetAdminBrandInfoSection[];

  static from(
    entity: BrandEntity,
    multilingualText: {
      languageId: number;
      brandText: MultilingualTextEntity[];
      sectionText: MultilingualTextEntity[];
    },
  ) {
    const nameTexts = multilingualText.brandText.filter(
      (text) => text.fieldName === 'name',
    );
    const descriptionTexts = multilingualText.brandText.filter(
      (text) => text.fieldName === 'description',
    );

    const nameField = new MultilingualFieldDto(
      nameTexts.map((text) => ({
        language: text.language.code,
        content: text.textContent,
      })),
    );

    const descriptionField = new MultilingualFieldDto(
      descriptionTexts.map((text) => ({
        language: text.language.code,
        content: text.textContent,
      })),
    );

    return plainToInstance(this, {
      languageId: multilingualText.languageId,
      name: nameField.getContent(),
      description: descriptionField.getContent(),
      section: entity.section.map((section) =>
        GetAdminBrandInfoSection.from(section, multilingualText.sectionText),
      ),
    });
  }
}
export class GetAdminBrandInfoResponse {
  @ApiProperty({
    description: '브랜드 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '카테고리 ID',
    example: 1,
  })
  categoryId: number;

  @ApiProperty({
    description: '영어 이름',
    example: 'Seoul Moment',
  })
  englishName: string;

  @ApiProperty({
    description: '프로필 이미지 URL',
    example:
      'https://image-dev.seoulmoment.com.tw/brand-profiles/2025-09-16/seoul-moment-profile.jpg',
  })
  profileImage: string;

  @ApiProperty({
    description: '상품 배너 이미지 URL',
    example:
      'https://image-dev.seoulmoment.com.tw/brand-banners/2025-09-16/seoul-moment-product-banner.jpg',
  })
  productBannerImage: string;

  @ApiProperty({
    description: '배너 이미지 URL 리스트',
    example: [
      'https://image-dev.seoulmoment.com.tw/brand-banners/2025-09-16/seoul-moment-banner-01.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-banners/2025-09-16/seoul-moment-banner-02.jpg',
    ],
    type: [String],
  })
  bannerList: string[];

  @ApiProperty({
    description: '모바일 배너 이미지 URL 리스트',
    example: [
      'https://image-dev.seoulmoment.com.tw/brand-banners/2025-09-16/seoul-moment-mobile-banner-01.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-banners/2025-09-16/seoul-moment-mobile-banner-02.jpg',
    ],
    type: [String],
  })
  mobileBannerList: string[];

  @ApiProperty({
    description: '다국어 브랜드 정보 리스트 (한국어, 영어, 중국어)',
    example: [
      {
        languageId: 1,
        name: '서울모먼트',
        description: '서울의 특별한 순간들을 담은 라이프스타일 브랜드입니다.',
        section: [
          {
            title: '브랜드 스토리',
            content:
              '서울모먼트는 2020년 설립된 라이프스타일 브랜드로, 서울의 특별한 순간들을 제품에 담아내고 있습니다.',
            imageList: [
              'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-story-01.jpg',
              'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-story-02.jpg',
            ],
          },
        ],
      },
      {
        languageId: 2,
        name: 'Seoul Moment',
        description:
          'A lifestyle brand that captures special moments in Seoul.',
        section: [
          {
            title: 'Brand Story',
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
        name: '首爾時刻',
        description: '捕捉首爾特殊時刻的生活方式品牌。',
        section: [
          {
            title: '品牌故事',
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
  multilingualTextList: GetAdminBrandInfoText[];

  static from(
    entity: BrandEntity,
    multilingualText: {
      languageId: number;
      brandText: MultilingualTextEntity[];
      sectionText: MultilingualTextEntity[];
    }[],
  ) {
    const multilingualTextList: GetAdminBrandInfoText[] = [];

    for (const text of multilingualText) {
      multilingualTextList.push(GetAdminBrandInfoText.from(entity, text));
    }

    return plainToInstance(this, {
      id: entity.id,
      categoryId: entity.categoryId,
      englishName: entity.englishName,
      profileImage: entity.getProfileImage(),
      productBannerImage: entity.getBannerImage(),
      bannerList: entity.bannerImage
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((v) => v.getImage()),
      mobileBannerList: entity.bannerImage
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((v) => v.getMobileImage()),
      multilingualTextList,
    });
  }
}

export class AdminBrandListRequest extends ListFilterDto {
  @ApiPropertyOptional({
    description: '검색 칼럼',
    example: BrandSearchEnum.NAME,
    enum: BrandSearchEnum,
  })
  @IsOptional()
  @IsEnum(BrandSearchEnum)
  searchColumn: BrandSearchEnum;
}

export class GetAdminBrandNameDto {
  @ApiProperty({
    description: '언어 코드',
    example: LanguageCode.KOREAN,
  })
  languageCode: LanguageCode;

  @ApiProperty({
    description: '브랜드 이름',
    example: '서울모먼트',
  })
  name: string;

  static from(languageCode: LanguageCode, name: string) {
    return plainToInstance(this, {
      languageCode,
      name,
    });
  }
}

export class GetAdminBrandResponse {
  @ApiProperty({
    description: '브랜드 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '브랜드 이름 리스트',
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        name: '서울모먼트',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        name: 'Seoul Moment',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        name: '首爾時刻',
      },
    ],
    type: [GetAdminBrandNameDto],
  })
  nameDto: GetAdminBrandNameDto[];

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

  static from(entity: BrandEntity, nameDto: GetAdminBrandNameDto[]) {
    return plainToInstance(this, {
      id: entity.id,
      nameDto,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

export class UpdateAdminBrandImage {
  @ApiProperty({
    description: '기존 배너 이미지 URL',
    example: '/brand-banners/2025-09-16/seoul-moment-banner-01.jpg',
  })
  @IsString()
  @IsDefined()
  oldImageUrl: string;

  @ApiProperty({
    description: '바뀔 배너 이미지 URL',
    example:
      'https://image-dev.seoulmoment.com.tw/brand-banners/2025-09-16/seoul-moment-banner-01-new.jpg',
  })
  @IsString()
  @IsDefined()
  newImageUrl: string;
}

export class UpdateAdminBrandSectionImageSortOrder {
  @ApiProperty({
    description: '기존 섹션 이미지 URL',
    example: '/brand-sections/2025-09-16/section-story-01.jpg',
  })
  @IsString()
  @IsDefined()
  imageUrl: string;

  @ApiProperty({
    description: '섹션 정렬 순서',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  sortOrder: number;
}

export class UpdateAdminBrandInfoSection {
  @ApiProperty({
    description: '섹션 ID',
    example: 1,
  })
  @IsInt()
  @IsDefined()
  id: number;

  @ApiPropertyOptional({
    description: '섹션 제목',
    example: '브랜드 스토리',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: '섹션 내용',
    example:
      '서울모먼트는 2020년 설립된 라이프스타일 브랜드로, 서울의 특별한 순간들을 제품에 담아내고 있습니다.',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: '섹션 이미지 리스트',
    type: [UpdateAdminBrandImage],
    example: [
      {
        oldImageUrl: '/brand-sections/2025-09-16/section-story-01.jpg',
        newImageUrl:
          'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-story-01-new.jpg',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAdminBrandImage)
  @IsOptional()
  sectionImageList?: UpdateAdminBrandImage[];

  @ApiPropertyOptional({
    description: '섹션 이미지 정렬 순서 리스트',
    type: [UpdateAdminBrandSectionImageSortOrder],
    example: [
      {
        imageUrl: '/brand-sections/2025-09-16/section-story-01.jpg',
        sortOrder: 1,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAdminBrandSectionImageSortOrder)
  @IsOptional()
  sortOrderList?: UpdateAdminBrandSectionImageSortOrder[];
}

export class UpdateAdminBrandInfoText {
  @ApiProperty({
    description: '언어 ID',
    example: 1,
  })
  @IsInt()
  @IsDefined()
  languageId: number;

  @ApiPropertyOptional({
    description: '브랜드 이름',
    example: '서울모먼트',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: '브랜드 설명',
    example:
      '서울의 특별한 순간들을 담은 라이프스타일 브랜드입니다. 한국의 전통미와 현대적 감각을 조화롭게 표현합니다.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: '브랜드 정보 섹션 리스트',
    type: [UpdateAdminBrandInfoSection],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAdminBrandInfoSection)
  section?: UpdateAdminBrandInfoSection[];
}

export class UpdateAdminBrandSectionSortOrder {
  @ApiProperty({
    description: '섹션 ID',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  sectionId: number;

  @ApiProperty({
    description: '섹션 정렬 순서',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  sortOrder: number;
}

export class UpdateAdminBrandRequest {
  @ApiPropertyOptional({
    description: '상품 배너 이미지',
    example:
      'https://image-dev.seoulmoment.com.tw/brand-products/2025-09-16/product-banner-01.jpg',
  })
  @IsOptional()
  @IsString()
  productBannerImage?: string;

  @ApiPropertyOptional({
    description: '프로필 이미지',
    example:
      'https://image-dev.seoulmoment.com.tw/brand-profiles/2025-09-16/seoul-moment-profile.jpg',
  })
  @IsOptional()
  @IsString()
  profileImage?: string;

  @ApiPropertyOptional({
    description: '영어 브랜드 이름',
    example: 'Seoul Moment',
  })
  @IsOptional()
  @IsString()
  englishName?: string;

  @ApiPropertyOptional({
    description: '배너 리스트',
    type: [UpdateAdminBrandImage],
    example: [
      {
        oldImageUrl: '/brand-banners/2025-09-16/seoul-moment-banner-01.jpg',
        newImageUrl:
          'https://image-dev.seoulmoment.com.tw/brand-banners/2025-09-16/seoul-moment-banner-01-new.jpg',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAdminBrandImage)
  @IsOptional()
  bannerList?: UpdateAdminBrandImage[];

  @ApiPropertyOptional({
    description: '모바일 배너 리스트',
    type: [UpdateAdminBrandImage],
    example: [
      {
        oldImageUrl:
          '/brand-mobile-banners/2025-09-16/seoul-moment-mobile-banner-01.jpg',
        newImageUrl:
          'https://image-dev.seoulmoment.com.tw/brand-mobile-banners/2025-09-16/seoul-moment-mobile-banner-01-new.jpg',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAdminBrandImage)
  @IsOptional()
  mobileBannerList?: UpdateAdminBrandImage[];

  @ApiPropertyOptional({
    description: '브랜드 정보 텍스트 리스트',
    type: [UpdateAdminBrandInfoText],
    example: [
      {
        languageId: 1,
        name: '서울모먼트',
        description: '서울의 특별한 순간들을 담은 라이프스타일 브랜드입니다.',
        section: [
          {
            id: 1,
            title: '브랜드 스토리',
            content:
              '서울모먼트는 2020년 설립된 라이프스타일 브랜드로, 서울의 특별한 순간들을 제품에 담아내고 있습니다.',
            sectionImageList: [
              {
                oldImageUrl: '/brand-sections/2025-09-16/section-story-01.jpg',
                newImageUrl:
                  'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-story-01-new.jpg',
              },
            ],
          },
        ],
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAdminBrandInfoText)
  @IsOptional()
  textList?: UpdateAdminBrandInfoText[];

  @ApiPropertyOptional({
    description: '섹션 정렬 순서 리스트',
    type: [UpdateAdminBrandSectionSortOrder],
    example: [
      {
        sectionId: 1,
        sortOrder: 1,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAdminBrandSectionSortOrder)
  @IsOptional()
  sectionSortOrderList?: UpdateAdminBrandSectionSortOrder[];
}

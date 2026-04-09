import { BrandSectionEntity } from '@app/repository/entity/brand-section.entity';
import { BrandEntity } from '@app/repository/entity/brand.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class AdminBrandLanguageDto {
  @ApiProperty({
    description: '언어 코드',
    example: LanguageCode.KOREAN,
    enum: LanguageCode,
  })
  @IsEnum(LanguageCode)
  @IsDefined()
  languageCode: LanguageCode;

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

export class AdminBrandSectionLanguageDto {
  @ApiProperty({
    description: '언어 코드',
    example: LanguageCode.KOREAN,
    enum: LanguageCode,
  })
  @IsEnum(LanguageCode)
  @IsDefined()
  languageCode: LanguageCode;

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

export class V1PostAdminBrandSection {
  @ApiProperty({
    description: '다국어 섹션 정보 리스트 (한국어, 영어, 중국어)',
    type: [AdminBrandSectionLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        title: '브랜드 스토리',
        content: '서울모먼트는 2020년 설립된 라이프스타일 브랜드입니다.',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        title: 'Brand Story',
        content: 'Seoul Moment is a lifestyle brand established in 2020.',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        title: '品牌故事',
        content: '首爾時刻是2020年成立的生活方式品牌。',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminBrandSectionLanguageDto)
  @IsDefined()
  languageList: AdminBrandSectionLanguageDto[];

  @ApiProperty({
    description: 'S3 업로드 후 섹션 이미지 URL (도메인 포함)',
    example: [
      'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-01.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-02.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-03.jpg',
    ],
  })
  @IsArray()
  @IsDefined()
  imageUrlList: string[];
}

export class V1PostAdminBrandRequest {
  @ApiProperty({
    description: '다국어 브랜드 정보 리스트 (한국어, 영어, 중국어)',
    type: [AdminBrandLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        name: '서울모먼트',
        description: '서울의 특별한 순간들을 담은 라이프스타일 브랜드입니다.',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        name: 'Seoul Moment',
        description:
          'A lifestyle brand that captures special moments in Seoul.',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        name: '首爾時刻',
        description: '捕捉首爾特殊時刻的生活方式品牌。',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminBrandLanguageDto)
  @IsDefined()
  languageList: AdminBrandLanguageDto[];

  @ApiProperty({
    description: '카테고리 ID',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  categoryId: number;

  @ApiPropertyOptional({
    description: 'S3 업로드 후 브랜드 프로필 이미지 URL (도메인 포함)',
    example:
      'https://image-dev.seoulmoment.com.tw/brand-profiles/2025-09-16/seoul-moment-profile.jpg',
  })
  @IsString()
  @IsOptional()
  profileImageUrl?: string;

  @ApiProperty({
    description: '브랜드 섹션 리스트 (브랜드 스토리, 연혁 등)',
    type: [V1PostAdminBrandSection],
    example: [
      {
        languageList: [
          {
            languageCode: LanguageCode.KOREAN,
            title: '브랜드 스토리',
            content:
              '서울모먼트는 2020년 설립된 라이프스타일 브랜드로, 서울의 특별한 순간들을 제품에 담아내고 있습니다.',
          },
          {
            languageCode: LanguageCode.ENGLISH,
            title: 'Brand Story',
            content:
              'Seoul Moment is a lifestyle brand established in 2020, capturing special moments in Seoul through our products.',
          },
          {
            languageCode: LanguageCode.TAIWAN,
            title: '品牌故事',
            content:
              '首爾時刻是2020年成立的生活方式品牌，透過產品捕捉首爾的特殊時刻。',
          },
        ],
        imageUrlList: [
          'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-01.jpg',
          'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-02.jpg',
          'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-03.jpg',
        ],
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => V1PostAdminBrandSection)
  @IsDefined()
  sectionList: V1PostAdminBrandSection[];

  @ApiProperty({
    description: 'S3 업로드 후 배너 이미지 URL (도메인 포함)',
    example: [
      'https://image-dev.seoulmoment.com.tw/brand-banners/2025-09-16/seoul-moment-banner-01.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-banners/2025-09-16/seoul-moment-banner-02.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-banners/2025-09-16/seoul-moment-banner-03.jpg',
    ],
  })
  @IsArray()
  @IsDefined()
  bannerImageUrlList: string[];

  @ApiProperty({
    description: 'S3 업로드 후 모바일 배너 이미지 URL (도메인 포함)',
    example: [
      'https://image-dev.seoulmoment.com.tw/brand-mobile-banners/2025-09-16/seoul-moment-mobile-banner-01.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-mobile-banners/2025-09-16/seoul-moment-mobile-banner-02.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-mobile-banners/2025-09-16/seoul-moment-mobile-banner-03.jpg',
    ],
  })
  @IsArray()
  @IsDefined()
  mobileBannerImageUrlList: string[];

  @ApiProperty({
    description: 'S3 업로드 후 상품 배너 이미지 URL (도메인 포함)',
    example:
      'https://image-dev.seoulmoment.com.tw/brand-products/2025-09-16/seoul-moment-product-banner.jpg',
  })
  @IsString()
  @IsDefined()
  productBannerImageUrl: string;

  @ApiProperty({
    description: '영어 브랜드 이름',
    example: 'Seoul Moment',
  })
  @IsString()
  @IsDefined()
  englishName: string;

  @ApiPropertyOptional({
    description: '색상 코드',
    example: '#FF0000',
  })
  @IsString()
  @IsOptional()
  colorCode?: string;
}

// ── Response DTOs ──
export class AdminBrandInfoSectionBase {
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

  @ApiProperty({
    description: '섹션 이미지 URL 리스트',
    example: [
      'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-story-01.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-story-02.jpg',
    ],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsDefined()
  imageUrlList: string[];

  // eslint-disable-next-line max-lines-per-function
  static from(
    entity: BrandSectionEntity,
    multilingualText: MultilingualTextEntity[],
  ) {
    const sectionTexts = multilingualText.filter(
      (text) => text.entityId === entity.id,
    );
    const title =
      sectionTexts.find((t) => t.fieldName === 'title')?.textContent ?? '';
    const content =
      sectionTexts.find((t) => t.fieldName === 'content')?.textContent ?? '';

    return plainToInstance(this, {
      id: entity.id,
      title,
      content,
      imageUrlList: entity.sectionImage
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((v) => v.getImageUrl()),
    });
  }
}

export class V1GetAdminBrandInfoSection extends AdminBrandInfoSectionBase {
  @ApiProperty({
    description: '섹션 ID',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  id: number;
}

export class V1GetAdminBrandInfoText extends AdminBrandLanguageDto {
  @ApiProperty({
    description: '브랜드 정보 섹션 리스트',
    example: [
      {
        id: 1,
        title: '브랜드 스토리',
        content:
          '서울모먼트는 2020년 설립된 라이프스타일 브랜드로, 서울의 특별한 순간들을 제품에 담아내고 있습니다.',
        imageUrlList: [
          'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-story-01.jpg',
          'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-story-02.jpg',
        ],
      },
    ],
    type: [V1GetAdminBrandInfoSection],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => V1GetAdminBrandInfoSection)
  @IsDefined()
  section: V1GetAdminBrandInfoSection[];

  // eslint-disable-next-line max-lines-per-function
  static from(
    entity: BrandEntity,
    multilingualText: {
      languageCode: LanguageCode;
      brandText: MultilingualTextEntity[];
      sectionText: MultilingualTextEntity[];
    },
  ) {
    const name =
      multilingualText.brandText.find((t) => t.fieldName === 'name')
        ?.textContent ?? '';
    const description =
      multilingualText.brandText.find((t) => t.fieldName === 'description')
        ?.textContent ?? '';

    return plainToInstance(this, {
      languageCode: multilingualText.languageCode,
      name,
      description,
      section: entity.section.map((section) =>
        V1GetAdminBrandInfoSection.from(section, multilingualText.sectionText),
      ),
    });
  }
}

export class V1UpdateAdminBrandInfoSection extends AdminBrandInfoSectionBase {}

export class V1UpdateAdminBrandInfoText extends AdminBrandLanguageDto {
  @ApiProperty({
    description: '브랜드 정보 섹션 리스트',
    example: [
      {
        title: '브랜드 스토리',
        content:
          '서울모먼트는 2020년 설립된 라이프스타일 브랜드로, 서울의 특별한 순간들을 제품에 담아내고 있습니다.',
        imageUrlList: [
          'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-story-01.jpg',
          'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-story-02.jpg',
        ],
      },
    ],
    type: [V1UpdateAdminBrandInfoSection],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => V1UpdateAdminBrandInfoSection)
  @IsDefined()
  section: V1UpdateAdminBrandInfoSection[];

  // eslint-disable-next-line max-lines-per-function
  static from(
    entity: BrandEntity,
    multilingualText: {
      languageCode: LanguageCode;
      brandText: MultilingualTextEntity[];
      sectionText: MultilingualTextEntity[];
    },
  ) {
    const name =
      multilingualText.brandText.find((t) => t.fieldName === 'name')
        ?.textContent ?? '';
    const description =
      multilingualText.brandText.find((t) => t.fieldName === 'description')
        ?.textContent ?? '';

    return plainToInstance(this, {
      languageCode: multilingualText.languageCode,
      name,
      description,
      section: entity.section.map((section) =>
        V1GetAdminBrandInfoSection.from(section, multilingualText.sectionText),
      ),
    });
  }
}

export class V1GetAdminBrandInfoResponse {
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
  profileImageUrl: string;

  @ApiProperty({
    description: '상품 배너 이미지 URL',
    example:
      'https://image-dev.seoulmoment.com.tw/brand-banners/2025-09-16/seoul-moment-product-banner.jpg',
  })
  productBannerImageUrl: string;

  @ApiProperty({
    description: '배너 이미지 URL 리스트',
    example: [
      'https://image-dev.seoulmoment.com.tw/brand-banners/2025-09-16/seoul-moment-banner-01.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-banners/2025-09-16/seoul-moment-banner-02.jpg',
    ],
    type: [String],
  })
  bannerImageUrlList: string[];

  @ApiProperty({
    description: '모바일 배너 이미지 URL 리스트',
    example: [
      'https://image-dev.seoulmoment.com.tw/brand-banners/2025-09-16/seoul-moment-mobile-banner-01.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-banners/2025-09-16/seoul-moment-mobile-banner-02.jpg',
    ],
    type: [String],
  })
  mobileBannerImageUrlList: string[];

  @ApiProperty({
    description: '다국어 브랜드 정보 리스트 (한국어, 영어, 중국어)',
    type: [V1GetAdminBrandInfoText],
  })
  languageList: V1GetAdminBrandInfoText[];

  @ApiProperty({
    description: '색상 코드',
    example: '#FF0000',
  })
  colorCode: string;

  // eslint-disable-next-line max-lines-per-function
  static from(
    entity: BrandEntity,
    multilingualText: {
      languageCode: LanguageCode;
      brandText: MultilingualTextEntity[];
      sectionText: MultilingualTextEntity[];
    }[],
  ) {
    const languageList: V1GetAdminBrandInfoText[] = [];

    for (const text of multilingualText) {
      languageList.push(V1GetAdminBrandInfoText.from(entity, text));
    }

    return plainToInstance(this, {
      id: entity.id,
      categoryId: entity.categoryId,
      englishName: entity.englishName,
      profileImageUrl: entity.getProfileImage(),
      productBannerImageUrl: entity.getBannerImage(),
      bannerImageUrlList: entity.bannerImage
        .filter((v) => v.imageUrl !== null && v.imageUrl !== '')
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((v) => v.getImageUrl()),
      mobileBannerImageUrlList: entity.mobileBannerImage
        .filter((v) => v.imageUrl !== null && v.imageUrl !== '')
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((v) => v.getImageUrl()),
      languageList,
      colorCode: entity.colorCode,
    });
  }
}

export class V1GetAdminBrandNameDto {
  @ApiProperty({
    description: '언어 코드',
    example: LanguageCode.KOREAN,
    enum: LanguageCode,
  })
  @IsEnum(LanguageCode)
  @IsDefined()
  languageCode: LanguageCode;

  @ApiProperty({
    description: '브랜드 이름',
    example: '서울모먼트',
  })
  @IsString()
  @IsDefined()
  name: string;
}

export class V1GetAdminBrandResponse {
  @ApiProperty({
    description: '브랜드 ID',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
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
    type: [V1GetAdminBrandNameDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => V1GetAdminBrandNameDto)
  @IsDefined()
  nameList: V1GetAdminBrandNameDto[];

  @ApiProperty({
    description: '생성일',
    example: '2025-01-01T12:00:00.000Z',
  })
  @IsString()
  @IsDefined()
  createDate: Date;

  @ApiProperty({
    description: '수정일',
    example: '2025-01-01T12:00:00.000Z',
  })
  @IsString()
  @IsDefined()
  updateDate: Date;

  @ApiProperty({
    description: '색상 코드',
    example: '#FF0000',
  })
  @IsString()
  @IsDefined()
  colorCode: string;

  // eslint-disable-next-line max-lines-per-function
  static from(
    entity: BrandEntity,
    multilingualTexts: MultilingualTextEntity[],
  ) {
    const brandTexts = multilingualTexts.filter(
      (t) => t.entityId === entity.id && t.fieldName === 'name',
    );

    const nameList = brandTexts.map((t) =>
      plainToInstance(V1GetAdminBrandNameDto, {
        languageCode: t.language.code,
        name: t.textContent,
      }),
    );

    return plainToInstance(this, {
      id: entity.id,
      nameList,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
      colorCode: entity.colorCode,
    });
  }
}

// ── Update Request DTO ──

export class V1UpdateAdminBrandRequest {
  @ApiProperty({
    description: '카테고리 ID',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  categoryId: number;

  @ApiProperty({
    description: '영어 브랜드 이름',
    example: 'Seoul Moment',
  })
  @IsDefined()
  @IsString()
  englishName: string;

  @ApiPropertyOptional({
    description: '프로필 이미지 URL (도메인 포함)',
    example:
      'https://image-dev.seoulmoment.com.tw/brand-profiles/2025-09-16/seoul-moment-profile.jpg',
  })
  @IsString()
  @IsOptional()
  profileImageUrl?: string;

  @ApiProperty({
    description: '상품 배너 이미지 URL (도메인 포함)',
    example:
      'https://image-dev.seoulmoment.com.tw/brand-products/2025-09-16/seoul-moment-product-banner.jpg',
  })
  @IsString()
  @IsDefined()
  productBannerImageUrl: string;

  @ApiProperty({
    description: '배너 이미지 URL 리스트 (전체 교체)',
    example: [
      'https://image-dev.seoulmoment.com.tw/brand-banners/2025-09-16/seoul-moment-banner-01.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-banners/2025-09-16/seoul-moment-banner-02.jpg',
    ],
  })
  @IsArray()
  @IsDefined()
  bannerImageUrlList: string[];

  @ApiProperty({
    description: '모바일 배너 이미지 URL 리스트 (전체 교체)',
    example: [
      'https://image-dev.seoulmoment.com.tw/brand-mobile-banners/2025-09-16/seoul-moment-mobile-banner-01.jpg',
      'https://image-dev.seoulmoment.com.tw/brand-mobile-banners/2025-09-16/seoul-moment-mobile-banner-02.jpg',
    ],
  })
  @IsArray()
  @IsDefined()
  mobileBannerImageUrlList: string[];

  @ApiProperty({
    description: '다국어 브랜드 정보 리스트 (전체 교체, 한국어/영어/중국어)',
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        name: '서울모먼트',
        description: '서울의 특별한 순간들을 담은 라이프스타일 브랜드입니다.',
        section: [
          {
            title: '브랜드 스토리',
            content:
              '서울모먼트는 2020년 설립된 라이프스타일 브랜드로, 서울의 특별한 순간들을 제품에 담아내고 있습니다.',
            imageUrlList: [
              'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-story-01.jpg',
              'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/section-story-02.jpg',
            ],
          },
        ],
      },
    ],
    type: [V1UpdateAdminBrandInfoText],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => V1UpdateAdminBrandInfoText)
  @IsDefined()
  languageList: V1UpdateAdminBrandInfoText[];

  @ApiPropertyOptional({
    description: '색상 코드',
    example: '#FF0000',
  })
  @IsOptional()
  @IsString()
  colorCode?: string;
}

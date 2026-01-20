/* eslint-disable max-lines-per-function */
import { BrandSectionEntity } from '@app/repository/entity/brand-section.entity';
import { BrandEntity } from '@app/repository/entity/brand.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { BrandNameFilter } from '@app/repository/enum/brand.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';

import { MultilingualFieldDto } from '../dto/multilingual.dto';

export class GetBrandIntroduceSection {
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
    language: LanguageCode = LanguageCode.KOREAN,
  ): GetBrandIntroduceSection {
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
      title: titleField.getContentByLanguageWithFallback(language) || '',
      content: contentField.getContentByLanguageWithFallback(language) || '',
      imageList: entity.sectionImage
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((v) => v.getImage()),
    });
  }
}

export class GetBrandIntroduceResponse {
  @ApiProperty({
    description: '브랜드 ID',
    example: 1,
  })
  id: number;

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
    type: [GetBrandIntroduceSection],
  })
  section: GetBrandIntroduceSection[];

  static from(
    entity: BrandEntity,
    multilingualText: {
      brandText: MultilingualTextEntity[];
      sectionText: MultilingualTextEntity[];
    },
    language: LanguageCode = LanguageCode.KOREAN,
  ): GetBrandIntroduceResponse {
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
      id: entity.id,
      bannerList: entity.bannerImage
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .filter((v) => v.imageUrl !== null && v.imageUrl !== '')
        .map((v) => v.getImage()),
      mobileBannerList: entity.mobileBannerImage
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .filter((v) => v.imageUrl !== null && v.imageUrl !== '')
        .map((v) => v.getImage()),
      name: nameField.getContentByLanguageWithFallback(language) || '',
      description:
        descriptionField.getContentByLanguageWithFallback(language) || '',
      section: entity.section
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((v) =>
          GetBrandIntroduceSection.from(
            v,
            multilingualText.sectionText,
            language,
          ),
        ),
    });
  }
}
export class GetBrandListByNameFilterTypeRequest {
  @ApiPropertyOptional({
    description: '카테고리 ID (선택사항)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  categoryId?: number;
}
export class GetBrandListByName {
  @ApiProperty({
    description: '브랜드 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '브랜드 이름',
    example: '서울모먼트',
  })
  name: string;

  static from(entity: BrandEntity, multilingualText: MultilingualTextEntity[]) {
    multilingualText = multilingualText.filter((v) => v.entityId === entity.id);

    const name = MultilingualFieldDto.fromByEntity(multilingualText, 'name');

    return plainToInstance(this, {
      id: entity.id,
      name: name.getContent(),
    });
  }
}

export class GetBrandListByNameResponse {
  @ApiProperty({
    description: '이니셜별 filter enum',
    example: BrandNameFilter.A_TO_D,
    enum: BrandNameFilter,
  })
  filter: BrandNameFilter;

  @ApiProperty({
    description: '브랜드 Object 리스트',
    type: GetBrandListByName,
    isArray: true,
    example: [
      { id: 1, name: '서울모먼트' },
      { id: 2, name: '부산메모리' },
    ],
  })
  brandNameList: GetBrandListByName[];

  static from(filter: BrandNameFilter, brandNameList: GetBrandListByName[]) {
    return plainToInstance(this, {
      filter,
      brandNameList,
    });
  }
}

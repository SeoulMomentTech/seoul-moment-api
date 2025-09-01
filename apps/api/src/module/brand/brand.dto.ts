import { BrandSectionEntity } from '@app/repository/entity/brand-section.entity';
import { BrandEntity } from '@app/repository/entity/brand.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

import { MultilingualFieldDto } from './dto/multilingual.dto';

export class GetBrandIntroduceSection {
  @ApiProperty({ description: '섹션 제목', example: '브랜드 스토리' })
  title: string;

  @ApiProperty({ description: '섹션 내용', example: '우리 브랜드는...' })
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
      imageList: entity.brandSectionImageList
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((v) => v.getImage()),
    });
  }
}

export class GetBrandIntroduceResponse {
  @ApiProperty({ description: '브랜드 ID', example: 1 })
  id: number;

  @ApiProperty({
    description: '배너 이미지 URL 리스트',
    example: [
      'https://example.com/banner1.jpg',
      'https://example.com/banner2.jpg',
    ],
    type: [String],
  })
  bannerList: string[];

  @ApiProperty({ description: '브랜드 이름', example: '서울모먼트' })
  name: string;

  @ApiProperty({
    description: '브랜드 설명',
    example: '서울의 특별한 순간들을 담은 브랜드',
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
      bannerList: entity.brandBannerImageList
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((v) => v.getImage()),
      name: nameField.getContentByLanguageWithFallback(language) || '',
      description:
        descriptionField.getContentByLanguageWithFallback(language) || '',
      section: entity.brandSectionList
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

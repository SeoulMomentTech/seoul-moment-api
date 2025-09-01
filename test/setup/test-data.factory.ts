import { DataSource } from 'typeorm';
import { BrandEntity } from '@app/repository/entity/brand.entity';
import { BrandBannerImageEntity } from '@app/repository/entity/brand-banner-image.entity';
import { BrandSectionEntity } from '@app/repository/entity/brand-info-section.entity';
import { BrandSectionImageEntity } from '@app/repository/entity/brand-section-image.entity';
import { LanguageEntity } from '@app/repository/entity/language.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { BrandStatus } from '@app/repository/enum/brand.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';

export class TestDataFactory {
  constructor(private dataSource: DataSource) {}

  /**
   * 기본 브랜드 생성
   */
  async createBrand(
    overrides: Partial<BrandEntity> = {},
  ): Promise<BrandEntity> {
    const brandRepository = this.dataSource.getRepository(BrandEntity);

    const brand = brandRepository.create({
      name: 'Test Brand',
      description: 'Test brand description',
      status: BrandStatus.NORMAL,
      ...overrides,
    });

    return brandRepository.save(brand);
  }

  /**
   * 브랜드 배너 이미지 생성
   */
  async createBannerImage(
    brand: BrandEntity,
    overrides: Partial<BrandBannerImageEntity> = {},
  ): Promise<BrandBannerImageEntity> {
    const bannerRepository = this.dataSource.getRepository(
      BrandBannerImageEntity,
    );

    const banner = bannerRepository.create({
      brandId: brand.id,
      imageUrl: 'https://example.com/banner.jpg',
      altText: 'Test banner image',
      sortOrder: 1,
      ...overrides,
    });

    return bannerRepository.save(banner);
  }

  /**
   * 브랜드 정보 섹션 생성
   */
  async createBrandSection(
    brand: BrandEntity,
    overrides: Partial<BrandSectionEntity> = {},
  ): Promise<BrandSectionEntity> {
    const sectionRepository = this.dataSource.getRepository(BrandSectionEntity);

    const section = sectionRepository.create({
      brandId: brand.id,
      title: 'Test Section',
      content: 'Test section content',
      sortOrder: 1,
      ...overrides,
    });

    return sectionRepository.save(section);
  }

  /**
   * 섹션 이미지 생성
   */
  async createSectionImage(
    section: BrandSectionEntity,
    overrides: Partial<BrandSectionImageEntity> = {},
  ): Promise<BrandSectionImageEntity> {
    const imageRepository = this.dataSource.getRepository(
      BrandSectionImageEntity,
    );

    const image = imageRepository.create({
      sectionId: section.id,
      imageUrl: 'https://example.com/section-image.jpg',
      altText: 'Test section image',
      sortOrder: 1,
      ...overrides,
    });

    return imageRepository.save(image);
  }

  /**
   * 완전한 브랜드 데이터 생성 (배너, 섹션, 섹션 이미지 포함)
   */
  async createFullBrand(
    options: {
      brand?: Partial<BrandEntity>;
      bannerCount?: number;
      sectionCount?: number;
      imagesPerSection?: number;
    } = {},
  ): Promise<BrandEntity> {
    const {
      brand: brandData = {},
      bannerCount = 2,
      sectionCount = 3,
      imagesPerSection = 2,
    } = options;

    // 1. 브랜드 생성
    const brand = await this.createBrand(brandData);

    // 2. 배너 이미지들 생성
    for (let i = 1; i <= bannerCount; i++) {
      await this.createBannerImage(brand, {
        imageUrl: `https://example.com/banner${i}.jpg`,
        altText: `Banner ${i}`,
        sortOrder: i,
      });
    }

    // 3. 정보 섹션들과 섹션 이미지들 생성
    for (let i = 1; i <= sectionCount; i++) {
      const section = await this.createBrandSection(brand, {
        title: `Section ${i}`,
        content: `Content for section ${i}`,
        sortOrder: i,
      });

      // 각 섹션에 이미지들 생성
      for (let j = 1; j <= imagesPerSection; j++) {
        await this.createSectionImage(section, {
          imageUrl: `https://example.com/section${i}-image${j}.jpg`,
          altText: `Section ${i} Image ${j}`,
          sortOrder: j,
        });
      }
    }

    return brand;
  }

  /**
   * 다양한 상태의 브랜드들 생성 (테스트용)
   */
  async createBrandsWithDifferentStatuses(): Promise<BrandEntity[]> {
    const brands = [];

    // NORMAL 상태 브랜드
    brands.push(
      await this.createBrand({
        name: 'Normal Brand',
        status: BrandStatus.NORMAL,
      }),
    );

    // WAIT 상태 브랜드
    brands.push(
      await this.createBrand({
        name: 'Waiting Brand',
        status: BrandStatus.WAIT,
      }),
    );

    // BLOCK 상태 브랜드
    brands.push(
      await this.createBrand({
        name: 'Blocked Brand',
        status: BrandStatus.BLOCK,
      }),
    );

    // DELETE 상태 브랜드
    brands.push(
      await this.createBrand({
        name: 'Deleted Brand',
        status: BrandStatus.DELETE,
      }),
    );

    return brands;
  }

  /**
   * 언어 생성
   */
  async createLanguage(
    overrides: Partial<LanguageEntity> = {},
  ): Promise<LanguageEntity> {
    const languageRepository = this.dataSource.getRepository(LanguageEntity);

    const language = languageRepository.create({
      code: LanguageCode.KOREAN,
      name: '한국어',
      englishName: 'Korean',
      isActive: true,
      sortOrder: 1,
      ...overrides,
    });

    return languageRepository.save(language);
  }

  /**
   * 다국어 텍스트 생성
   */
  async createMultilingualText(
    entityType: string,
    entityId: number,
    fieldName: string,
    language: LanguageEntity,
    textContent: string,
    overrides: Partial<MultilingualTextEntity> = {},
  ): Promise<MultilingualTextEntity> {
    const textRepository = this.dataSource.getRepository(MultilingualTextEntity);

    const text = textRepository.create({
      entityType,
      entityId,
      fieldName,
      languageId: language.id,
      textContent,
      ...overrides,
    });

    return textRepository.save(text);
  }

  /**
   * 기본 언어들 생성 (한국어, 영어, 중국어)
   */
  async createDefaultLanguages(): Promise<{
    korean: LanguageEntity;
    english: LanguageEntity;
    chinese: LanguageEntity;
  }> {
    const korean = await this.createLanguage({
      code: LanguageCode.KOREAN,
      name: '한국어',
      englishName: 'Korean',
      sortOrder: 1,
    });

    const english = await this.createLanguage({
      code: LanguageCode.ENGLISH,
      name: 'English',
      englishName: 'English',
      sortOrder: 2,
    });

    const chinese = await this.createLanguage({
      code: LanguageCode.CHINESE,
      name: '中文',
      englishName: 'Chinese',
      sortOrder: 3,
    });

    return { korean, english, chinese };
  }

  /**
   * 다국어 브랜드 생성 (브랜드와 다국어 텍스트를 함께 생성)
   */
  async createMultilingualBrand(
    brandData: Partial<BrandEntity> = {},
    multilingualData?: {
      name?: { [key in LanguageCode]?: string };
      description?: { [key in LanguageCode]?: string };
    },
  ): Promise<{
    brand: BrandEntity;
    languages: { korean: LanguageEntity; english: LanguageEntity; chinese: LanguageEntity };
    texts: MultilingualTextEntity[];
  }> {
    // Create brand
    const brand = await this.createBrand(brandData);

    // Create languages
    const languages = await this.createDefaultLanguages();

    // Create multilingual texts
    const texts: MultilingualTextEntity[] = [];

    if (multilingualData?.name) {
      for (const [langCode, content] of Object.entries(multilingualData.name)) {
        const language = Object.values(languages).find(l => l.code === langCode);
        if (language && content) {
          const text = await this.createMultilingualText(
            'Brand',
            brand.id,
            'name',
            language,
            content,
          );
          texts.push(text);
        }
      }
    }

    if (multilingualData?.description) {
      for (const [langCode, content] of Object.entries(multilingualData.description)) {
        const language = Object.values(languages).find(l => l.code === langCode);
        if (language && content) {
          const text = await this.createMultilingualText(
            'Brand',
            brand.id,
            'description',
            language,
            content,
          );
          texts.push(text);
        }
      }
    }

    return { brand, languages, texts };
  }
}

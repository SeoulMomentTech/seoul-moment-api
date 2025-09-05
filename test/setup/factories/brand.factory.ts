import { BrandBannerImageEntity } from '@app/repository/entity/brand-banner-image.entity';
import { BrandSectionImageEntity } from '@app/repository/entity/brand-section-image.entity';
import { BrandSectionEntity } from '@app/repository/entity/brand-section.entity';
import { BrandEntity } from '@app/repository/entity/brand.entity';
import { LanguageEntity } from '@app/repository/entity/language.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { BrandStatus } from '@app/repository/enum/brand.enum';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { DataSource } from 'typeorm';

import { LanguageFactory } from './language.factory';

export class BrandFactory {
  private languageFactory: LanguageFactory;

  constructor(private dataSource: DataSource) {
    this.languageFactory = new LanguageFactory(dataSource);
  }

  /**
   * 기본 브랜드 생성
   */
  async createBrand(
    overrides: Partial<BrandEntity> = {},
  ): Promise<BrandEntity> {
    const brandRepository = this.dataSource.getRepository(BrandEntity);

    const brand = brandRepository.create({
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
      sortOrder: 1,
      ...overrides,
    });

    return imageRepository.save(image);
  }

  /**
   * 완전한 브랜드 데이터 생성 (배너, 섹션, 섹션 이미지 포함) - 레거시 버전
   */
  async createFullBrand(options?: {
    brand?: Partial<BrandEntity>;
    bannerCount?: number;
    sectionCount?: number;
    imagesPerSection?: number;
  }): Promise<BrandEntity>;

  /**
   * 완전한 브랜드 데이터 생성 (새로운 구조) - 다국어 지원
   */
  async createFullBrand(options: {
    brand?: Partial<BrandEntity>;
    banners?: Array<{ sortOrder: number; imageUrl: string }>;
    sections?: Array<{
      sortOrder: number;
      images?: Array<{ sortOrder: number; imageUrl: string }>;
    }>;
  }): Promise<BrandEntity>;

  async createFullBrand(
    options:
      | {
          brand?: Partial<BrandEntity>;
          bannerCount?: number;
          sectionCount?: number;
          imagesPerSection?: number;
        }
      | {
          brand?: Partial<BrandEntity>;
          banners?: Array<{
            sortOrder: number;
            imageUrl: string;
          }>;
          sections?: Array<{
            sortOrder: number;
            images?: Array<{
              sortOrder: number;
              imageUrl: string;
            }>;
          }>;
        } = {},
  ): Promise<BrandEntity> {
    // Default empty object if options is undefined
    if (!options) {
      options = {};
    }

    // 새로운 구조 처리
    if ('banners' in options || 'sections' in options) {
      const { brand: brandData = {}, banners = [], sections = [] } = options;

      // 1. 브랜드 생성
      const brand = await this.createBrand(brandData);

      // 2. 배너 이미지들 생성
      for (const bannerData of banners) {
        await this.createBannerImage(brand, {
          imageUrl: bannerData.imageUrl,
          sortOrder: bannerData.sortOrder,
        });
      }

      // 3. 정보 섹션들과 섹션 이미지들 생성
      for (const sectionData of sections) {
        const section = await this.createBrandSection(brand, {
          sortOrder: sectionData.sortOrder,
        });

        // 각 섹션에 이미지들 생성
        if (sectionData.images) {
          for (const imageData of sectionData.images) {
            await this.createSectionImage(section, {
              imageUrl: imageData.imageUrl,
              sortOrder: imageData.sortOrder,
            });
          }
        }
      }

      // 4. 관계가 로드된 브랜드를 다시 조회해서 반환
      const brandRepository = this.dataSource.getRepository(BrandEntity);
      const reloadedBrand = await brandRepository.findOne({
        where: { id: brand.id },
        relations: ['bannerImage', 'section', 'section.sectionImage'],
      });

      return reloadedBrand || brand;
    }

    // 기존 레거시 구조 처리
    const {
      brand: brandData = {},
      bannerCount = 2,
      sectionCount = 3,
      imagesPerSection = 2,
    } = options as {
      brand?: Partial<BrandEntity>;
      bannerCount?: number;
      sectionCount?: number;
      imagesPerSection?: number;
    };

    // 1. 브랜드 생성
    const brand = await this.createBrand(brandData);

    // 2. 배너 이미지들 생성
    for (let i = 1; i <= bannerCount; i++) {
      await this.createBannerImage(brand, {
        imageUrl: `https://example.com/banner${i}.jpg`,
        sortOrder: i,
      });
    }

    // 3. 정보 섹션들과 섹션 이미지들 생성
    for (let i = 1; i <= sectionCount; i++) {
      const section = await this.createBrandSection(brand, {
        sortOrder: i,
      });

      // 각 섹션에 이미지들 생성
      for (let j = 1; j <= imagesPerSection; j++) {
        await this.createSectionImage(section, {
          imageUrl: `https://example.com/section${i}-image${j}.jpg`,
          sortOrder: j,
        });
      }
    }

    // 4. 관계가 로드된 브랜드를 다시 조회해서 반환
    const brandRepository = this.dataSource.getRepository(BrandEntity);
    const reloadedBrand = await brandRepository.findOne({
      where: { id: brand.id },
      relations: ['bannerImage', 'section', 'section.sectionImage'],
    });

    return reloadedBrand || brand;
  }

  /**
   * 다양한 상태의 브랜드들 생성 (테스트용)
   */
  async createBrandsWithDifferentStatuses(): Promise<BrandEntity[]> {
    const brands = [];

    // NORMAL 상태 브랜드
    brands.push(
      await this.createBrand({
        status: BrandStatus.NORMAL,
      }),
    );

    // WAIT 상태 브랜드
    brands.push(
      await this.createBrand({
        status: BrandStatus.WAIT,
      }),
    );

    // BLOCK 상태 브랜드
    brands.push(
      await this.createBrand({
        status: BrandStatus.BLOCK,
      }),
    );

    // DELETE 상태 브랜드
    brands.push(
      await this.createBrand({
        status: BrandStatus.DELETE,
      }),
    );

    return brands;
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
    languages: {
      korean: LanguageEntity;
      english: LanguageEntity;
      chinese: LanguageEntity;
    };
    texts: MultilingualTextEntity[];
  }> {
    // Create brand
    const brand = await this.createBrand(brandData);

    // Create languages
    const languages = await this.languageFactory.createDefaultLanguages();

    // Create multilingual texts
    const texts: MultilingualTextEntity[] = [];

    if (multilingualData?.name) {
      for (const [langCode, content] of Object.entries(multilingualData.name)) {
        const language = Object.values(languages).find(
          (l) => l.code === langCode,
        );
        if (language && content) {
          const text = await this.languageFactory.createMultilingualText(
            EntityType.BRAND,
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
      for (const [langCode, content] of Object.entries(
        multilingualData.description,
      )) {
        const language = Object.values(languages).find(
          (l) => l.code === langCode,
        );
        if (language && content) {
          const text = await this.languageFactory.createMultilingualText(
            EntityType.BRAND,
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

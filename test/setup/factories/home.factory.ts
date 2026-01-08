import { HomeBannerImageEntity } from '@app/repository/entity/home-banner-image.entity';
import { HomeSectionImageEntity } from '@app/repository/entity/home-section-image.entity';
import { HomeSectionEntity } from '@app/repository/entity/home-section.entity';
import { LanguageEntity } from '@app/repository/entity/language.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { DataSource } from 'typeorm';

import { LanguageFactory } from './language.factory';

export class HomeFactory {
  private languageFactory: LanguageFactory;

  constructor(private dataSource: DataSource) {
    this.languageFactory = new LanguageFactory(dataSource);
  }

  /**
   * Home Banner Image 생성
   */
  async createHomeBannerImage(
    overrides: Partial<HomeBannerImageEntity> = {},
  ): Promise<HomeBannerImageEntity> {
    const bannerRepository = this.dataSource.getRepository(
      HomeBannerImageEntity,
    );

    const banner = bannerRepository.create({
      imageUrl: 'https://example.com/home-banner.jpg',
      sortOrder: 1,
      ...overrides,
    });

    return bannerRepository.save(banner);
  }

  /**
   * Home Section 생성
   */
  async createHomeSection(
    overrides: Partial<HomeSectionEntity> = {},
  ): Promise<HomeSectionEntity> {
    const sectionRepository = this.dataSource.getRepository(HomeSectionEntity);

    const section = sectionRepository.create({
      url: 'https://example.com',
      urlName: 'Example Link',
      sortOrder: 1,
      ...overrides,
    });

    return sectionRepository.save(section);
  }

  /**
   * Home Section Image 생성
   */
  async createHomeSectionImage(
    section: HomeSectionEntity,
    overrides: Partial<HomeSectionImageEntity> = {},
  ): Promise<HomeSectionImageEntity> {
    const imageRepository = this.dataSource.getRepository(
      HomeSectionImageEntity,
    );

    const image = imageRepository.create({
      sectionId: section.id,
      imageUrl: 'https://example.com/home-section-image.jpg',
      sortOrder: 1,
      ...overrides,
    });

    return imageRepository.save(image);
  }

  /**
   * 완전한 Home 데이터 생성 (배너, 섹션, 섹션 이미지 포함)
   */
  async createFullHome(options?: {
    bannerCount?: number;
    sectionCount?: number;
    imagesPerSection?: number;
  }): Promise<{
    banners: HomeBannerImageEntity[];
    sections: HomeSectionEntity[];
  }>;

  async createFullHome(options: {
    banners?: Array<{ sortOrder: number; imageUrl: string }>;
    sections?: Array<{
      sortOrder: number;
      url?: string;
      urlName?: string;
      images?: Array<{ sortOrder: number; imageUrl: string }>;
    }>;
  }): Promise<{
    banners: HomeBannerImageEntity[];
    sections: HomeSectionEntity[];
  }>;

  async createFullHome(
    options:
      | {
          bannerCount?: number;
          sectionCount?: number;
          imagesPerSection?: number;
        }
      | {
          banners?: Array<{ sortOrder: number; imageUrl: string }>;
          sections?: Array<{
            sortOrder: number;
            url?: string;
            urlName?: string;
            images?: Array<{ sortOrder: number; imageUrl: string }>;
          }>;
        } = {},
  ): Promise<{
    banners: HomeBannerImageEntity[];
    sections: HomeSectionEntity[];
  }> {
    if (!options) {
      options = {};
    }

    const banners: HomeBannerImageEntity[] = [];
    const sections: HomeSectionEntity[] = [];

    // 새로운 구조 처리
    if ('banners' in options || 'sections' in options) {
      const { banners: bannerData = [], sections: sectionData = [] } = options;

      // 배너 이미지들 생성
      for (const banner of bannerData) {
        const createdBanner = await this.createHomeBannerImage({
          imageUrl: banner.imageUrl,
          sortOrder: banner.sortOrder,
        });
        banners.push(createdBanner);
      }

      // 섹션들과 섹션 이미지들 생성
      for (const section of sectionData) {
        const createdSection = await this.createHomeSection({
          sortOrder: section.sortOrder,
          url: section.url,
          urlName: section.urlName,
        });
        sections.push(createdSection);

        // 각 섹션에 이미지들 생성
        if (section.images) {
          for (const imageData of section.images) {
            await this.createHomeSectionImage(createdSection, {
              imageUrl: imageData.imageUrl,
              sortOrder: imageData.sortOrder,
            });
          }
        }
      }

      return { banners, sections };
    }

    // 기존 레거시 구조 처리
    const {
      bannerCount = 3,
      sectionCount = 4,
      imagesPerSection = 2,
    } = options as {
      bannerCount?: number;
      sectionCount?: number;
      imagesPerSection?: number;
    };

    // 배너 이미지들 생성
    for (let i = 1; i <= bannerCount; i++) {
      const banner = await this.createHomeBannerImage({
        imageUrl: `https://example.com/home-banner${i}.jpg`,
        sortOrder: i,
      });
      banners.push(banner);
    }

    // 섹션들과 섹션 이미지들 생성
    for (let i = 1; i <= sectionCount; i++) {
      const section = await this.createHomeSection({
        url: `https://example.com/section${i}`,
        urlName: `Section ${i}`,
        sortOrder: i,
      });
      sections.push(section);

      // 각 섹션에 이미지들 생성
      for (let j = 1; j <= imagesPerSection; j++) {
        await this.createHomeSectionImage(section, {
          imageUrl: `https://example.com/home-section${i}-image${j}.jpg`,
          sortOrder: j,
        });
      }
    }

    return { banners, sections };
  }

  /**
   * 다국어 Home Section 생성
   */
  async createMultilingualHomeSection(
    sectionData: Partial<HomeSectionEntity> = {},
    multilingualData?: {
      title?: { [key in LanguageCode]?: string };
      description?: { [key in LanguageCode]?: string };
    },
  ): Promise<{
    section: HomeSectionEntity;
    languages: {
      korean: LanguageEntity;
      english: LanguageEntity;
      chinese: LanguageEntity;
    };
    texts: MultilingualTextEntity[];
  }> {
    // 섹션 생성
    const section = await this.createHomeSection(sectionData);

    // 언어 생성
    const languages = await this.languageFactory.createDefaultLanguages();

    // 다국어 텍스트 생성
    const texts: MultilingualTextEntity[] = [];

    if (multilingualData?.title) {
      for (const [langCode, content] of Object.entries(
        multilingualData.title,
      )) {
        const language = Object.values(languages).find(
          (l) => l.code === langCode,
        );
        if (language && content) {
          const text = await this.languageFactory.createMultilingualText(
            EntityType.HOME_SECTION,
            section.id,
            'title',
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
            EntityType.HOME_SECTION,
            section.id,
            'description',
            language,
            content,
          );
          texts.push(text);
        }
      }
    }

    return { section, languages, texts };
  }
}
/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import { ArticleSectionImageEntity } from '@app/repository/entity/article-section-image.entity';
import { ArticleSectionEntity } from '@app/repository/entity/article-section.entity';
import { ArticleEntity } from '@app/repository/entity/article.entity';
import { BrandBannerImageEntity } from '@app/repository/entity/brand-banner-image.entity';
import { BrandSectionImageEntity } from '@app/repository/entity/brand-section-image.entity';
import { BrandSectionEntity } from '@app/repository/entity/brand-section.entity';
import { BrandEntity } from '@app/repository/entity/brand.entity';
import { CategoryEntity } from '@app/repository/entity/category.entity';
import { HomeBannerImageEntity } from '@app/repository/entity/home-banner-image.entity';
import { HomeSectionImageEntity } from '@app/repository/entity/home-section-image.entity';
import { HomeSectionEntity } from '@app/repository/entity/home-section.entity';
import { LanguageEntity } from '@app/repository/entity/language.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { NewsSectionImageEntity } from '@app/repository/entity/news-section-image.entity';
import { NewsSectionEntity } from '@app/repository/entity/news-section.entity';
import { NewsEntity } from '@app/repository/entity/news.entity';
import { ArticleStatus } from '@app/repository/enum/article.enum';
import { BrandStatus } from '@app/repository/enum/brand.enum';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { NewsStatus } from '@app/repository/enum/news.enum';
import { DataSource } from 'typeorm';

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
        },
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
    entityType: EntityType,
    entityId: number,
    fieldName: string,
    language: LanguageEntity,
    textContent: string,
    overrides: Partial<MultilingualTextEntity> = {},
  ): Promise<MultilingualTextEntity> {
    const textRepository = this.dataSource.getRepository(
      MultilingualTextEntity,
    );

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
    const languages = await this.createDefaultLanguages();

    // Create multilingual texts
    const texts: MultilingualTextEntity[] = [];

    if (multilingualData?.name) {
      for (const [langCode, content] of Object.entries(multilingualData.name)) {
        const language = Object.values(languages).find(
          (l) => l.code === langCode,
        );
        if (language && content) {
          const text = await this.createMultilingualText(
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
          const text = await this.createMultilingualText(
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

  /**
   * 카테고리 생성
   */
  async createCategory(
    overrides: Partial<CategoryEntity> = {},
  ): Promise<CategoryEntity> {
    const categoryRepository = this.dataSource.getRepository(CategoryEntity);

    const category = categoryRepository.create({
      name: 'Test Category',
      ...overrides,
    });

    return categoryRepository.save(category);
  }

  /**
   * Article 생성
   */
  async createArticle(
    category: CategoryEntity,
    brand?: BrandEntity,
    overrides: Partial<ArticleEntity> = {},
  ): Promise<ArticleEntity> {
    const articleRepository = this.dataSource.getRepository(ArticleEntity);

    const article = articleRepository.create({
      categoryId: category.id,
      brandId: brand?.id,
      writer: 'Test Writer',
      status: ArticleStatus.NORMAL,
      ...overrides,
    });

    return articleRepository.save(article);
  }

  /**
   * Article Section 생성
   */
  async createArticleSection(
    article: ArticleEntity,
    overrides: Partial<ArticleSectionEntity> = {},
  ): Promise<ArticleSectionEntity> {
    const sectionRepository =
      this.dataSource.getRepository(ArticleSectionEntity);

    const section = sectionRepository.create({
      articleId: article.id,
      sortOrder: 1,
      ...overrides,
    });

    return sectionRepository.save(section);
  }

  /**
   * Article Section Image 생성
   */
  async createArticleSectionImage(
    section: ArticleSectionEntity,
    overrides: Partial<ArticleSectionImageEntity> = {},
  ): Promise<ArticleSectionImageEntity> {
    const imageRepository = this.dataSource.getRepository(
      ArticleSectionImageEntity,
    );

    const image = imageRepository.create({
      sectionId: section.id,
      imageUrl: 'https://example.com/article-section-image.jpg',
      sortOrder: 1,
      ...overrides,
    });

    return imageRepository.save(image);
  }

  /**
   * 완전한 Article 데이터 생성 (카테고리, 브랜드, 섹션, 섹션 이미지 포함)
   */
  async createFullArticle(options?: {
    category?: Partial<CategoryEntity>;
    brand?: Partial<BrandEntity>;
    article?: Partial<ArticleEntity>;
    sectionCount?: number;
    imagesPerSection?: number;
  }): Promise<ArticleEntity>;

  async createFullArticle(options: {
    category?: Partial<CategoryEntity>;
    brand?: Partial<BrandEntity>;
    article?: Partial<ArticleEntity>;
    sections?: Array<{
      sortOrder: number;
      images?: Array<{ sortOrder: number; imageUrl: string }>;
    }>;
  }): Promise<ArticleEntity>;

  async createFullArticle(
    options:
      | {
          category?: Partial<CategoryEntity>;
          brand?: Partial<BrandEntity>;
          article?: Partial<ArticleEntity>;
          sectionCount?: number;
          imagesPerSection?: number;
        }
      | {
          category?: Partial<CategoryEntity>;
          brand?: Partial<BrandEntity>;
          article?: Partial<ArticleEntity>;
          sections?: Array<{
            sortOrder: number;
            images?: Array<{
              sortOrder: number;
              imageUrl: string;
            }>;
          }>;
        },
  ): Promise<ArticleEntity> {
    if (!options) {
      options = {};
    }

    // 카테고리 생성
    const category = await this.createCategory(options.category || {});

    // 브랜드 생성 (옵션)
    const brand = options.brand
      ? await this.createBrand(options.brand)
      : undefined;

    // 새로운 구조 처리
    if ('sections' in options) {
      const { article: articleData = {}, sections = [] } = options;

      // Article 생성
      const article = await this.createArticle(category, brand, articleData);

      // 섹션들과 섹션 이미지들 생성
      for (const sectionData of sections) {
        const section = await this.createArticleSection(article, {
          sortOrder: sectionData.sortOrder,
        });

        // 각 섹션에 이미지들 생성
        if (sectionData.images) {
          for (const imageData of sectionData.images) {
            await this.createArticleSectionImage(section, {
              imageUrl: imageData.imageUrl,
              sortOrder: imageData.sortOrder,
            });
          }
        }
      }

      // 관계가 로드된 Article을 다시 조회해서 반환
      const articleRepository = this.dataSource.getRepository(ArticleEntity);
      const reloadedArticle = await articleRepository.findOne({
        where: { id: article.id },
        relations: ['category', 'section', 'section.sectionImage'],
      });

      return reloadedArticle || article;
    }

    // 기존 레거시 구조 처리
    const {
      article: articleData = {},
      sectionCount = 2,
      imagesPerSection = 2,
    } = options as {
      category?: Partial<CategoryEntity>;
      article?: Partial<ArticleEntity>;
      sectionCount?: number;
      imagesPerSection?: number;
    };

    // Article 생성
    const article = await this.createArticle(category, brand, articleData);

    // 섹션들과 섹션 이미지들 생성
    for (let i = 1; i <= sectionCount; i++) {
      const section = await this.createArticleSection(article, {
        sortOrder: i,
      });

      // 각 섹션에 이미지들 생성
      for (let j = 1; j <= imagesPerSection; j++) {
        await this.createArticleSectionImage(section, {
          imageUrl: `https://example.com/article-section${i}-image${j}.jpg`,
          sortOrder: j,
        });
      }
    }

    // 관계가 로드된 Article을 다시 조회해서 반환
    const articleRepository = this.dataSource.getRepository(ArticleEntity);
    const reloadedArticle = await articleRepository.findOne({
      where: { id: article.id },
      relations: ['category', 'section', 'section.sectionImage'],
    });

    return reloadedArticle || article;
  }

  /**
   * News 생성
   */
  async createNews(
    category: CategoryEntity,
    brand?: BrandEntity,
    overrides: Partial<NewsEntity> = {},
  ): Promise<NewsEntity> {
    const newsRepository = this.dataSource.getRepository(NewsEntity);

    const news = newsRepository.create({
      categoryId: category.id,
      brandId: brand?.id,
      writer: 'Test Writer',
      status: NewsStatus.NORMAL,
      ...overrides,
    });

    return newsRepository.save(news);
  }

  /**
   * News Section 생성
   */
  async createNewsSection(
    news: NewsEntity,
    overrides: Partial<NewsSectionEntity> = {},
  ): Promise<NewsSectionEntity> {
    const sectionRepository = this.dataSource.getRepository(NewsSectionEntity);

    const section = sectionRepository.create({
      newsId: news.id,
      sortOrder: 1,
      ...overrides,
    });

    return sectionRepository.save(section);
  }

  /**
   * News Section Image 생성
   */
  async createNewsSectionImage(
    section: NewsSectionEntity,
    overrides: Partial<NewsSectionImageEntity> = {},
  ): Promise<NewsSectionImageEntity> {
    const imageRepository = this.dataSource.getRepository(
      NewsSectionImageEntity,
    );

    const image = imageRepository.create({
      sectionId: section.id,
      imageUrl: 'https://example.com/news-section-image.jpg',
      sortOrder: 1,
      ...overrides,
    });

    return imageRepository.save(image);
  }

  /**
   * 완전한 News 데이터 생성 (카테고리, 브랜드, 섹션, 섹션 이미지 포함)
   */
  async createFullNews(options?: {
    category?: Partial<CategoryEntity>;
    brand?: Partial<BrandEntity>;
    news?: Partial<NewsEntity>;
    sectionCount?: number;
    imagesPerSection?: number;
  }): Promise<NewsEntity>;

  async createFullNews(options: {
    category?: Partial<CategoryEntity>;
    brand?: Partial<BrandEntity>;
    news?: Partial<NewsEntity>;
    sections?: Array<{
      sortOrder: number;
      images?: Array<{ sortOrder: number; imageUrl: string }>;
    }>;
  }): Promise<NewsEntity>;

  async createFullNews(
    options:
      | {
          category?: Partial<CategoryEntity>;
          brand?: Partial<BrandEntity>;
          news?: Partial<NewsEntity>;
          sectionCount?: number;
          imagesPerSection?: number;
        }
      | {
          category?: Partial<CategoryEntity>;
          brand?: Partial<BrandEntity>;
          news?: Partial<NewsEntity>;
          sections?: Array<{
            sortOrder: number;
            images?: Array<{
              sortOrder: number;
              imageUrl: string;
            }>;
          }>;
        },
  ): Promise<NewsEntity> {
    if (!options) {
      options = {};
    }

    // 카테고리 생성
    const category = await this.createCategory(options.category || {});

    // 브랜드 생성 (옵션)
    const brand = options.brand
      ? await this.createBrand(options.brand)
      : undefined;

    // 새로운 구조 처리
    if ('sections' in options) {
      const { news: newsData = {}, sections = [] } = options;

      // News 생성
      const news = await this.createNews(category, brand, newsData);

      // 섹션들과 섹션 이미지들 생성
      for (const sectionData of sections) {
        const section = await this.createNewsSection(news, {
          sortOrder: sectionData.sortOrder,
        });

        // 각 섹션에 이미지들 생성
        if (sectionData.images) {
          for (const imageData of sectionData.images) {
            await this.createNewsSectionImage(section, {
              imageUrl: imageData.imageUrl,
              sortOrder: imageData.sortOrder,
            });
          }
        }
      }

      // 관계가 로드된 News를 다시 조회해서 반환
      const newsRepository = this.dataSource.getRepository(NewsEntity);
      const reloadedNews = await newsRepository.findOne({
        where: { id: news.id },
        relations: ['category', 'section', 'section.sectionImage'],
      });

      return reloadedNews || news;
    }

    // 기존 레거시 구조 처리
    const {
      news: newsData = {},
      sectionCount = 2,
      imagesPerSection = 2,
    } = options as {
      category?: Partial<CategoryEntity>;
      news?: Partial<NewsEntity>;
      sectionCount?: number;
      imagesPerSection?: number;
    };

    // News 생성
    const news = await this.createNews(category, brand, newsData);

    // 섹션들과 섹션 이미지들 생성
    for (let i = 1; i <= sectionCount; i++) {
      const section = await this.createNewsSection(news, {
        sortOrder: i,
      });

      // 각 섹션에 이미지들 생성
      for (let j = 1; j <= imagesPerSection; j++) {
        await this.createNewsSectionImage(section, {
          imageUrl: `https://example.com/news-section${i}-image${j}.jpg`,
          sortOrder: j,
        });
      }
    }

    // 관계가 로드된 News를 다시 조회해서 반환
    const newsRepository = this.dataSource.getRepository(NewsEntity);
    const reloadedNews = await newsRepository.findOne({
      where: { id: news.id },
      relations: ['category', 'section', 'section.sectionImage'],
    });

    return reloadedNews || news;
  }

  /**
   * 다양한 상태의 Article들 생성 (테스트용)
   */
  async createArticlesWithDifferentStatuses(
    category?: CategoryEntity,
    brand?: BrandEntity,
  ): Promise<ArticleEntity[]> {
    const testCategory = category || (await this.createCategory());
    const testBrand = brand || (await this.createBrand());
    const articles = [];

    // NORMAL 상태 Article
    articles.push(
      await this.createArticle(testCategory, testBrand, {
        status: ArticleStatus.NORMAL,
        writer: 'Normal Writer',
      }),
    );

    // DELETE 상태 Article
    articles.push(
      await this.createArticle(testCategory, testBrand, {
        status: ArticleStatus.DELETE,
        writer: 'Deleted Writer',
      }),
    );

    return articles;
  }

  /**
   * 다양한 상태의 News들 생성 (테스트용)
   */
  async createNewsWithDifferentStatuses(
    category?: CategoryEntity,
    brand?: BrandEntity,
  ): Promise<NewsEntity[]> {
    const testCategory = category || (await this.createCategory());
    const testBrand = brand || (await this.createBrand());
    const news = [];

    // NORMAL 상태 News
    news.push(
      await this.createNews(testCategory, testBrand, {
        status: NewsStatus.NORMAL,
        writer: 'Normal Writer',
      }),
    );

    // DELETE 상태 News
    news.push(
      await this.createNews(testCategory, testBrand, {
        status: NewsStatus.DELETE,
        writer: 'Deleted Writer',
      }),
    );

    return news;
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
        },
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
    const languages = await this.createDefaultLanguages();

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
          const text = await this.createMultilingualText(
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
          const text = await this.createMultilingualText(
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

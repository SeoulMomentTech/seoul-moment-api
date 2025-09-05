import { BrandEntity } from '@app/repository/entity/brand.entity';
import { CategoryEntity } from '@app/repository/entity/category.entity';
import { NewsSectionImageEntity } from '@app/repository/entity/news-section-image.entity';
import { NewsSectionEntity } from '@app/repository/entity/news-section.entity';
import { NewsEntity } from '@app/repository/entity/news.entity';
import { NewsStatus } from '@app/repository/enum/news.enum';
import { DataSource } from 'typeorm';

import { BrandFactory } from './brand.factory';
import { CategoryFactory } from './category.factory';

export class NewsFactory {
  private brandFactory: BrandFactory;
  private categoryFactory: CategoryFactory;

  constructor(private dataSource: DataSource) {
    this.brandFactory = new BrandFactory(dataSource);
    this.categoryFactory = new CategoryFactory(dataSource);
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
        } = {},
  ): Promise<NewsEntity> {
    if (!options) {
      options = {};
    }

    // 카테고리 생성
    const category = await this.categoryFactory.createCategory(
      options.category || {},
    );

    // 브랜드 생성 (옵션)
    const brand = options.brand
      ? await this.brandFactory.createBrand(options.brand)
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
   * 다양한 상태의 News들 생성 (테스트용)
   */
  async createNewsWithDifferentStatuses(
    category?: CategoryEntity,
    brand?: BrandEntity,
  ): Promise<NewsEntity[]> {
    const testCategory =
      category || (await this.categoryFactory.createCategory());
    const testBrand = brand || (await this.brandFactory.createBrand());
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
}

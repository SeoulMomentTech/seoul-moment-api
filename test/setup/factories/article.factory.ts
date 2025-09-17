import { ArticleSectionImageEntity } from '@app/repository/entity/article-section-image.entity';
import { ArticleSectionEntity } from '@app/repository/entity/article-section.entity';
import { ArticleEntity } from '@app/repository/entity/article.entity';
import { BrandEntity } from '@app/repository/entity/brand.entity';
import { CategoryEntity } from '@app/repository/entity/category.entity';
import { ArticleStatus } from '@app/repository/enum/article.enum';
import { DataSource } from 'typeorm';

import { BrandFactory } from './brand.factory';
import { CategoryFactory } from './category.factory';

export class ArticleFactory {
  private brandFactory: BrandFactory;
  private categoryFactory: CategoryFactory;

  constructor(private dataSource: DataSource) {
    this.brandFactory = new BrandFactory(dataSource);
    this.categoryFactory = new CategoryFactory(dataSource);
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
        } = {},
  ): Promise<ArticleEntity> {
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
   * 다양한 상태의 Article들 생성 (테스트용)
   */
  async createArticlesWithDifferentStatuses(
    category?: CategoryEntity,
    brand?: BrandEntity,
  ): Promise<ArticleEntity[]> {
    const testCategory =
      category || (await this.categoryFactory.createCategory());
    const testBrand = brand || (await this.brandFactory.createBrand());
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
}

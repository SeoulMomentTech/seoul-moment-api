import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { ArticleEntity } from '@app/repository/entity/article.entity';
import { ArticleStatus } from '@app/repository/enum/article.enum';
import { ArticleRepositoryService } from '@app/repository/service/article.repository.service';
import { Test, TestingModule } from '@nestjs/testing';

import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('ArticleRepositoryService Integration Tests', () => {
  let articleRepositoryService: ArticleRepositoryService;
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    module = await Test.createTestingModule({
      imports: [TestDatabaseModule],
      providers: [ArticleRepositoryService],
    }).compile();

    articleRepositoryService = module.get<ArticleRepositoryService>(
      ArticleRepositoryService,
    );
    testDataFactory = new TestDataFactory(TestSetup.getDataSource());
  });

  afterAll(async () => {
    await module.close();
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    await TestSetup.clearDatabase();
  });

  describe('findAllNormalArticleList', () => {
    it('should return only articles with NORMAL status', async () => {
      // Given: 다양한 상태의 Article들 생성
      await testDataFactory.createArticlesWithDifferentStatuses();

      // When: NORMAL 상태 Article들 조회
      const result = await articleRepositoryService.findAllNormalArticleList();

      // Then: NORMAL 상태 Article만 반환
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(ArticleStatus.NORMAL);
    });

    it('should return empty array when no normal articles exist', async () => {
      // Given: NORMAL 상태가 아닌 Article들만 생성
      const category = await testDataFactory.createCategory();
      const brand = await testDataFactory.createBrand();
      await testDataFactory.createArticle(category, brand, {
        status: ArticleStatus.DELETE,
      });

      // When: NORMAL 상태 Article들 조회
      const result = await articleRepositoryService.findAllNormalArticleList();

      // Then: 빈 배열 반환
      expect(result).toHaveLength(0);
    });

    it('should return articles with eager loaded relations', async () => {
      // Given: 완전한 Article 데이터 생성 (카테고리, 섹션, 이미지 포함)
      await testDataFactory.createFullArticle({
        article: { status: ArticleStatus.NORMAL },
        sections: [
          {
            sortOrder: 1,
            images: [
              { sortOrder: 1, imageUrl: 'section1-1.jpg' },
              { sortOrder: 2, imageUrl: 'section1-2.jpg' },
            ],
          },
          {
            sortOrder: 2,
            images: [
              { sortOrder: 1, imageUrl: 'section2-1.jpg' },
              { sortOrder: 2, imageUrl: 'section2-2.jpg' },
            ],
          },
        ],
      });

      // When: Article 조회
      const result = await articleRepositoryService.findAllNormalArticleList();

      // Then: 관련 데이터가 eager loading으로 포함됨
      expect(result).toHaveLength(1);

      const article = result[0];
      expect(article.category).toBeDefined();
      expect(article.section).toHaveLength(2);
      expect(article.section[0].sectionImage).toHaveLength(2);
    });

    it('should sort sections by sortOrder', async () => {
      // Given: 정렬 순서가 다른 Article 데이터 생성
      const category = await testDataFactory.createCategory();
      const brand = await testDataFactory.createBrand();
      const article = await testDataFactory.createArticle(category, brand, {
        status: ArticleStatus.NORMAL,
      });

      // 섹션을 역순으로 생성
      await testDataFactory.createArticleSection(article, { sortOrder: 3 });
      await testDataFactory.createArticleSection(article, { sortOrder: 1 });
      await testDataFactory.createArticleSection(article, { sortOrder: 2 });

      // When: Article 조회
      const result = await articleRepositoryService.findAllNormalArticleList();

      // Then: sortOrder에 따라 정렬됨
      const articleResult = result[0];
      const sortedSections = articleResult.section.sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      expect(sortedSections[0].sortOrder).toBe(1);
      expect(sortedSections[1].sortOrder).toBe(2);
      expect(sortedSections[2].sortOrder).toBe(3);
    });
  });

  describe('findArticleById', () => {
    it('should return article when exists with NORMAL status', async () => {
      // Given: NORMAL 상태 Article 생성
      const category = await testDataFactory.createCategory();
      const brand = await testDataFactory.createBrand();
      const createdArticle = await testDataFactory.createArticle(category, brand, {
        status: ArticleStatus.NORMAL,
      });

      // When: Article ID로 조회
      const result = await articleRepositoryService.findArticleById(
        createdArticle.id,
      );

      // Then: Article 반환
      expect(result).toBeDefined();
      expect(result.id).toBe(createdArticle.id);
      expect(result.status).toBe(ArticleStatus.NORMAL);
    });

    it('should return null when article does not exist', async () => {
      // When: 존재하지 않는 Article ID로 조회
      const result = await articleRepositoryService.findArticleById(999);

      // Then: null 반환
      expect(result).toBeNull();
    });

    it('should return null when article exists but not NORMAL status', async () => {
      // Given: DELETE 상태 Article 생성
      const category = await testDataFactory.createCategory();
      const brand = await testDataFactory.createBrand();
      const deletedArticle = await testDataFactory.createArticle(category, brand, {
        status: ArticleStatus.DELETE,
      });

      // When: Article ID로 조회
      const result = await articleRepositoryService.findArticleById(
        deletedArticle.id,
      );

      // Then: null 반환 (NORMAL 상태가 아니므로)
      expect(result).toBeNull();
    });
  });

  describe('findLastArticleByCount', () => {
    it('should return latest articles by count with NORMAL status only', async () => {
      // Given: 여러 Article을 시간차로 생성
      const category = await testDataFactory.createCategory();
      const brand = await testDataFactory.createBrand();
      const articles = [];

      for (let i = 1; i <= 5; i++) {
        const article = await testDataFactory.createArticle(category, brand, {
          status: ArticleStatus.NORMAL,
          writer: `Writer ${i}`,
        });
        articles.push(article);
        // 시간차 생성을 위한 작은 지연
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // DELETE 상태 Article도 생성 (결과에 포함되지 않아야 함)
      await testDataFactory.createArticle(category, brand, {
        status: ArticleStatus.DELETE,
        writer: 'Deleted Writer',
      });

      // When: 최신 3개 Article 조회
      const result = await articleRepositoryService.findLastArticleByCount(3);

      // Then: 최신 3개 NORMAL 상태 Article만 반환
      expect(result).toHaveLength(3);

      // 최신 순서대로 정렬되어 있는지 확인
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].createDate.getTime()).toBeGreaterThanOrEqual(
          result[i + 1].createDate.getTime(),
        );
      }

      // 모든 Article이 NORMAL 상태인지 확인
      result.forEach((article) => {
        expect(article.status).toBe(ArticleStatus.NORMAL);
      });
    });

    it('should return empty array when no normal articles exist', async () => {
      // Given: DELETE 상태 Article들만 생성
      const category = await testDataFactory.createCategory();
      const brand = await testDataFactory.createBrand();
      await testDataFactory.createArticle(category, brand, {
        status: ArticleStatus.DELETE,
      });
      await testDataFactory.createArticle(category, brand, {
        status: ArticleStatus.DELETE,
      });

      // When: 최신 Article 조회
      const result = await articleRepositoryService.findLastArticleByCount(3);

      // Then: 빈 배열 반환
      expect(result).toHaveLength(0);
    });

    it('should return fewer articles when requested count exceeds available', async () => {
      // Given: 2개의 NORMAL Article만 생성
      const category = await testDataFactory.createCategory();
      const brand = await testDataFactory.createBrand();
      await testDataFactory.createArticle(category, brand, {
        status: ArticleStatus.NORMAL,
      });
      await testDataFactory.createArticle(category, brand, {
        status: ArticleStatus.NORMAL,
      });

      // When: 5개 요청하지만 2개만 존재
      const result = await articleRepositoryService.findLastArticleByCount(5);

      // Then: 실제 존재하는 2개만 반환
      expect(result).toHaveLength(2);
    });

    it('should return articles with eager loaded relations', async () => {
      // Given: 완전한 Article 데이터 생성
      const article = await testDataFactory.createFullArticle({
        article: { status: ArticleStatus.NORMAL },
        sections: [
          {
            sortOrder: 1,
            images: [{ sortOrder: 1, imageUrl: 'test.jpg' }],
          },
        ],
      });

      // When: 최신 Article 조회
      const result = await articleRepositoryService.findLastArticleByCount(1);

      // Then: 관련 데이터가 eager loading으로 포함됨
      expect(result).toHaveLength(1);
      expect(result[0].category).toBeDefined();
      expect(result[0].section).toHaveLength(1);
      expect(result[0].section[0].sectionImage).toHaveLength(1);
    });

    it('should handle zero count parameter', async () => {
      // Given: Article 생성
      const category = await testDataFactory.createCategory();
      const brand = await testDataFactory.createBrand();
      await testDataFactory.createArticle(category, brand, {
        status: ArticleStatus.NORMAL,
      });

      // When: count가 0인 경우
      const result = await articleRepositoryService.findLastArticleByCount(0);

      // Then: take: 0은 제한 없음을 의미하므로 모든 데이터 반환
      expect(result).toHaveLength(1);
    });
  });

  describe('getArticleById', () => {
    it('should return article when exists with NORMAL status', async () => {
      // Given: 완전한 Article 데이터 생성
      const createdArticle = await testDataFactory.createFullArticle({
        article: { status: ArticleStatus.NORMAL },
      });

      // When: Article ID로 조회
      const result = await articleRepositoryService.getArticleById(
        createdArticle.id,
      );

      // Then: Article과 관련 데이터 반환
      expect(result).toBeDefined();
      expect(result.id).toBe(createdArticle.id);
      expect(result.category).toBeDefined();
      expect(result.section).toBeDefined();
    });

    it('should throw ServiceError when article does not exist', async () => {
      // When & Then: 존재하지 않는 Article ID로 조회 시 에러 발생
      await expect(
        articleRepositoryService.getArticleById(999),
      ).rejects.toThrow(ServiceError);

      try {
        await articleRepositoryService.getArticleById(999);
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        expect(error.message).toBe('Article not found or not in normal status');
        expect(error.getCode()).toBe(ServiceErrorCode.NOT_FOUND_DATA);
      }
    });

    it('should throw ServiceError when article exists but not NORMAL status', async () => {
      // Given: DELETE 상태 Article 생성
      const category = await testDataFactory.createCategory();
      const brand = await testDataFactory.createBrand();
      const deletedArticle = await testDataFactory.createArticle(category, brand, {
        status: ArticleStatus.DELETE,
      });

      // When & Then: DELETE 상태 Article 조회 시 에러 발생
      await expect(
        articleRepositoryService.getArticleById(deletedArticle.id),
      ).rejects.toThrow(ServiceError);
    });

    it('should return article with all nested relations', async () => {
      // Given: 복잡한 Article 데이터 생성
      const article = await testDataFactory.createFullArticle({
        article: { status: ArticleStatus.NORMAL },
        sections: [
          {
            sortOrder: 1,
            images: [
              { sortOrder: 1, imageUrl: 'section1-1.jpg' },
              { sortOrder: 2, imageUrl: 'section1-2.jpg' },
              { sortOrder: 3, imageUrl: 'section1-3.jpg' },
            ],
          },
          {
            sortOrder: 2,
            images: [
              { sortOrder: 1, imageUrl: 'section2-1.jpg' },
              { sortOrder: 2, imageUrl: 'section2-2.jpg' },
              { sortOrder: 3, imageUrl: 'section2-3.jpg' },
            ],
          },
          {
            sortOrder: 3,
            images: [
              { sortOrder: 1, imageUrl: 'section3-1.jpg' },
              { sortOrder: 2, imageUrl: 'section3-2.jpg' },
              { sortOrder: 3, imageUrl: 'section3-3.jpg' },
            ],
          },
        ],
      });

      // When: Article 조회
      const result = await articleRepositoryService.getArticleById(article.id);

      // Then: 모든 중첩된 관계 데이터 포함
      expect(result.category).toBeDefined();
      expect(result.section).toHaveLength(3);

      result.section.forEach((section) => {
        expect(section.sectionImage).toHaveLength(3);
        expect(section.sectionImage[0]).toHaveProperty('imageUrl');
        expect(section.sectionImage[0]).toHaveProperty('sortOrder');
      });
    });
  });

  describe('Database constraints and validation', () => {
    it('should handle concurrent access correctly', async () => {
      // Given: Article 생성
      const category = await testDataFactory.createCategory();
      const brand = await testDataFactory.createBrand();
      const article = await testDataFactory.createArticle(category, brand, {
        status: ArticleStatus.NORMAL,
      });

      // When: 동시에 같은 Article 조회
      const promises = Array(5)
        .fill(null)
        .map(() => articleRepositoryService.getArticleById(article.id));

      const results = await Promise.all(promises);

      // Then: 모든 요청이 성공적으로 같은 Article 반환
      results.forEach((result) => {
        expect(result.id).toBe(article.id);
        expect(result.status).toBe(article.status);
      });
    });

    it('should maintain data integrity with cascading deletes', async () => {
      // Given: 완전한 Article 데이터 생성
      const article = await testDataFactory.createFullArticle();

      // When: Article 삭제 (CASCADE로 관련 데이터도 삭제됨)
      const dataSource = TestSetup.getDataSource();
      await dataSource.getRepository(ArticleEntity).remove(article);

      // Then: Article 조회 시 null 반환
      const result = await articleRepositoryService.findArticleById(article.id);
      expect(result).toBeNull();
    });
  });
});

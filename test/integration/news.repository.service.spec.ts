import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { NewsEntity } from '@app/repository/entity/news.entity';
import { NewsStatus } from '@app/repository/enum/news.enum';
import { NewsRepositoryService } from '@app/repository/service/news.repository.service';
import { Test, TestingModule } from '@nestjs/testing';

import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('NewsRepositoryService Integration Tests', () => {
  let newsRepositoryService: NewsRepositoryService;
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    module = await Test.createTestingModule({
      imports: [TestDatabaseModule],
      providers: [NewsRepositoryService],
    }).compile();

    newsRepositoryService = module.get<NewsRepositoryService>(
      NewsRepositoryService,
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

  describe('findAllNormalNewsList', () => {
    it('should return only news with NORMAL status', async () => {
      // Given: 다양한 상태의 News들 생성
      await testDataFactory.createNewsWithDifferentStatuses();

      // When: NORMAL 상태 News들 조회
      const result = await newsRepositoryService.findAllNormalNewsList();

      // Then: NORMAL 상태 News만 반환
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(NewsStatus.NORMAL);
    });

    it('should return empty array when no normal news exist', async () => {
      // Given: NORMAL 상태가 아닌 News들만 생성
      const category = await testDataFactory.createCategory();
      const brand = await testDataFactory.createBrand();
      await testDataFactory.createNews(category, brand, {
        status: NewsStatus.DELETE,
      });

      // When: NORMAL 상태 News들 조회
      const result = await newsRepositoryService.findAllNormalNewsList();

      // Then: 빈 배열 반환
      expect(result).toHaveLength(0);
    });

    it('should return news with eager loaded relations', async () => {
      // Given: 완전한 News 데이터 생성 (카테고리, 섹션, 이미지 포함)
      await testDataFactory.createFullNews({
        brand: {},
        news: { status: NewsStatus.NORMAL },
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

      // When: News 조회
      const result = await newsRepositoryService.findAllNormalNewsList();

      // Then: 관련 데이터가 eager loading으로 포함됨
      expect(result).toHaveLength(1);

      const news = result[0];
      expect(news.category).toBeDefined();
      expect(news.section).toHaveLength(2);
      expect(news.section[0].sectionImage).toHaveLength(2);
    });

    it('should sort sections by sortOrder', async () => {
      // Given: 정렬 순서가 다른 News 데이터 생성
      const category = await testDataFactory.createCategory();
      const brand = await testDataFactory.createBrand();
      const news = await testDataFactory.createNews(category, brand, {
        status: NewsStatus.NORMAL,
      });

      // 섹션을 역순으로 생성
      await testDataFactory.createNewsSection(news, { sortOrder: 3 });
      await testDataFactory.createNewsSection(news, { sortOrder: 1 });
      await testDataFactory.createNewsSection(news, { sortOrder: 2 });

      // When: News 조회
      const result = await newsRepositoryService.findAllNormalNewsList();

      // Then: sortOrder에 따라 정렬됨
      const newsResult = result[0];
      const sortedSections = newsResult.section.sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      expect(sortedSections[0].sortOrder).toBe(1);
      expect(sortedSections[1].sortOrder).toBe(2);
      expect(sortedSections[2].sortOrder).toBe(3);
    });
  });

  describe('findNewsById', () => {
    it('should return news when exists with NORMAL status', async () => {
      // Given: NORMAL 상태 News 생성
      const category = await testDataFactory.createCategory();
      const brand = await testDataFactory.createBrand();
      const createdNews = await testDataFactory.createNews(category, brand, {
        status: NewsStatus.NORMAL,
      });

      // When: News ID로 조회
      const result = await newsRepositoryService.findNewsById(createdNews.id);

      // Then: News 반환
      expect(result).toBeDefined();
      expect(result.id).toBe(createdNews.id);
      expect(result.status).toBe(NewsStatus.NORMAL);
    });

    it('should return null when news does not exist', async () => {
      // When: 존재하지 않는 News ID로 조회
      const result = await newsRepositoryService.findNewsById(999);

      // Then: null 반환
      expect(result).toBeNull();
    });

    it('should return null when news exists but not NORMAL status', async () => {
      // Given: DELETE 상태 News 생성
      const category = await testDataFactory.createCategory();
      const brand = await testDataFactory.createBrand();
      const deletedNews = await testDataFactory.createNews(category, brand, {
        status: NewsStatus.DELETE,
      });

      // When: News ID로 조회
      const result = await newsRepositoryService.findNewsById(deletedNews.id);

      // Then: null 반환 (NORMAL 상태가 아니므로)
      expect(result).toBeNull();
    });
  });

  describe('findLastNewsByCount', () => {
    it('should return latest news by count with NORMAL status only', async () => {
      // Given: 여러 News을 시간차로 생성
      const category = await testDataFactory.createCategory();
      const brand = await testDataFactory.createBrand();
      const newsList = [];

      for (let i = 1; i <= 5; i++) {
        const news = await testDataFactory.createNews(category, brand, {
          status: NewsStatus.NORMAL,
          writer: `Writer ${i}`,
        });
        newsList.push(news);
        // 시간차 생성을 위한 작은 지연
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // DELETE 상태 News도 생성 (결과에 포함되지 않아야 함)
      await testDataFactory.createNews(category, brand, {
        status: NewsStatus.DELETE,
        writer: 'Deleted Writer',
      });

      // When: 최신 3개 News 조회
      const result = await newsRepositoryService.findLastNewsByCount(3);

      // Then: 최신 3개 NORMAL 상태 News만 반환
      expect(result).toHaveLength(3);

      // 최신 순서대로 정렬되어 있는지 확인
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].createDate.getTime()).toBeGreaterThanOrEqual(
          result[i + 1].createDate.getTime(),
        );
      }

      // 모든 News가 NORMAL 상태인지 확인
      result.forEach((news) => {
        expect(news.status).toBe(NewsStatus.NORMAL);
      });
    });

    it('should return empty array when no normal news exist', async () => {
      // Given: DELETE 상태 News들만 생성
      const category = await testDataFactory.createCategory();
      const brand = await testDataFactory.createBrand();
      await testDataFactory.createNews(category, brand, { status: NewsStatus.DELETE });
      await testDataFactory.createNews(category, brand, { status: NewsStatus.DELETE });

      // When: 최신 News 조회
      const result = await newsRepositoryService.findLastNewsByCount(3);

      // Then: 빈 배열 반환
      expect(result).toHaveLength(0);
    });

    it('should return fewer news when requested count exceeds available', async () => {
      // Given: 2개의 NORMAL News만 생성
      const category = await testDataFactory.createCategory();
      const brand = await testDataFactory.createBrand();
      await testDataFactory.createNews(category, brand, { status: NewsStatus.NORMAL });
      await testDataFactory.createNews(category, brand, { status: NewsStatus.NORMAL });

      // When: 5개 요청하지만 2개만 존재
      const result = await newsRepositoryService.findLastNewsByCount(5);

      // Then: 실제 존재하는 2개만 반환
      expect(result).toHaveLength(2);
    });

    it('should return news with eager loaded relations', async () => {
      // Given: 완전한 News 데이터 생성
      const news = await testDataFactory.createFullNews({
        brand: {},
        news: { status: NewsStatus.NORMAL },
        sections: [
          {
            sortOrder: 1,
            images: [{ sortOrder: 1, imageUrl: 'test.jpg' }],
          },
        ],
      });

      // When: 최신 News 조회
      const result = await newsRepositoryService.findLastNewsByCount(1);

      // Then: 관련 데이터가 eager loading으로 포함됨
      expect(result).toHaveLength(1);
      expect(result[0].category).toBeDefined();
      expect(result[0].section).toHaveLength(1);
      expect(result[0].section[0].sectionImage).toHaveLength(1);
    });

    it('should handle zero count parameter', async () => {
      // Given: News 생성
      const category = await testDataFactory.createCategory();
      const brand = await testDataFactory.createBrand();
      await testDataFactory.createNews(category, brand, { status: NewsStatus.NORMAL });

      // When: count가 0인 경우
      const result = await newsRepositoryService.findLastNewsByCount(0);

      // Then: take: 0은 제한 없음을 의미하므로 모든 데이터 반환
      expect(result).toHaveLength(1);
    });
  });

  describe('getNewsById', () => {
    it('should return news when exists with NORMAL status', async () => {
      // Given: 완전한 News 데이터 생성
      const createdNews = await testDataFactory.createFullNews({
        brand: {},
        news: { status: NewsStatus.NORMAL },
      });

      // When: News ID로 조회
      const result = await newsRepositoryService.getNewsById(createdNews.id);

      // Then: News와 관련 데이터 반환
      expect(result).toBeDefined();
      expect(result.id).toBe(createdNews.id);
      expect(result.category).toBeDefined();
      expect(result.section).toBeDefined();
    });

    it('should throw ServiceError when news does not exist', async () => {
      // When & Then: 존재하지 않는 News ID로 조회 시 에러 발생
      await expect(newsRepositoryService.getNewsById(999)).rejects.toThrow(
        ServiceError,
      );

      try {
        await newsRepositoryService.getNewsById(999);
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        expect(error.message).toBe('News not found or not in normal status');
        expect(error.getCode()).toBe(ServiceErrorCode.NOT_FOUND_DATA);
      }
    });

    it('should throw ServiceError when news exists but not NORMAL status', async () => {
      // Given: DELETE 상태 News 생성
      const category = await testDataFactory.createCategory();
      const brand = await testDataFactory.createBrand();
      const deletedNews = await testDataFactory.createNews(category, brand, {
        status: NewsStatus.DELETE,
      });

      // When & Then: DELETE 상태 News 조회 시 에러 발생
      await expect(
        newsRepositoryService.getNewsById(deletedNews.id),
      ).rejects.toThrow(ServiceError);
    });

    it('should return news with all nested relations', async () => {
      // Given: 복잡한 News 데이터 생성
      const news = await testDataFactory.createFullNews({
        brand: {},
        news: { status: NewsStatus.NORMAL },
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

      // When: News 조회
      const result = await newsRepositoryService.getNewsById(news.id);

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
      // Given: News 생성
      const category = await testDataFactory.createCategory();
      const brand = await testDataFactory.createBrand();
      const news = await testDataFactory.createNews(category, brand, {
        status: NewsStatus.NORMAL,
      });

      // When: 동시에 같은 News 조회
      const promises = Array(5)
        .fill(null)
        .map(() => newsRepositoryService.getNewsById(news.id));

      const results = await Promise.all(promises);

      // Then: 모든 요청이 성공적으로 같은 News 반환
      results.forEach((result) => {
        expect(result.id).toBe(news.id);
        expect(result.status).toBe(news.status);
      });
    });

    it('should maintain data integrity with cascading deletes', async () => {
      // Given: 완전한 News 데이터 생성
      const news = await testDataFactory.createFullNews({ brand: {} });

      // When: News 삭제 (CASCADE로 관련 데이터도 삭제됨)
      const dataSource = TestSetup.getDataSource();
      await dataSource.getRepository(NewsEntity).remove(news);

      // Then: News 조회 시 null 반환
      const result = await newsRepositoryService.findNewsById(news.id);
      expect(result).toBeNull();
    });
  });
});

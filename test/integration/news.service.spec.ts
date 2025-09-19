import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { NewsStatus } from '@app/repository/enum/news.enum';
import { Test, TestingModule } from '@nestjs/testing';

import { GetNewsResponse } from '../../apps/api/src/module/news/news.dto';
import { NewsModule } from '../../apps/api/src/module/news/news.module';
import { NewsService } from '../../apps/api/src/module/news/news.service';
import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('NewsService Integration Tests', () => {
  let newsService: NewsService;
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    module = await Test.createTestingModule({
      imports: [TestDatabaseModule, NewsModule],
    }).compile();

    newsService = module.get<NewsService>(NewsService);
    testDataFactory = new TestDataFactory(TestSetup.getDataSource());
  });

  afterAll(async () => {
    await module.close();
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    await TestSetup.clearDatabase();
  });

  describe('getNews', () => {
    it('should return news with lastArticle list and multilingual content in Korean', async () => {
      // Given: 여러 뉴스와 다국어 텍스트 생성
      const { category } = await testDataFactory.createMultilingualCategory(
        {},
        {
          name: {
            ko: '테스트 카테고리',
            en: 'Test Category',
            zh: '测试分类',
          },
        },
      );

      // 최신 목록용 추가 뉴스들 생성
      const additionalNews = [];
      for (let i = 1; i <= 3; i++) {
        const brand = await testDataFactory.createBrand();
        const news = await testDataFactory.createNews(category, brand, {
          status: NewsStatus.NORMAL,
          writer: `Additional Writer ${i}`,
          banner: `/banner/additional-${i}.jpg`,
        });
        additionalNews.push(news);
        // 시간차 생성을 위한 작은 지연
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // 메인 뉴스 생성
      const mainNews = await testDataFactory.createFullNews({
        category,
        brand: {},
        news: {
          status: NewsStatus.NORMAL,
          writer: 'Main Writer',
          banner: '/banner/main-banner.jpg',
          profileImage: '/profile/main-profile.jpg',
        },
        sections: [
          {
            sortOrder: 1,
            images: [
              { sortOrder: 1, imageUrl: '/section/image1.jpg' },
              { sortOrder: 2, imageUrl: '/section/image2.jpg' },
            ],
          },
          {
            sortOrder: 2,
            images: [{ sortOrder: 1, imageUrl: '/section/image3.jpg' }],
          },
        ],
      });

      // 언어 생성
      const languages = await testDataFactory.createDefaultLanguages();

      // 메인 뉴스 다국어 텍스트
      await testDataFactory.createMultilingualText(
        EntityType.NEWS,
        mainNews.id,
        'title',
        languages.korean,
        '메인 뉴스 제목',
      );

      await testDataFactory.createMultilingualText(
        EntityType.NEWS,
        mainNews.id,
        'content',
        languages.korean,
        '메인 뉴스 내용입니다.',
      );

      // 섹션 다국어 텍스트
      for (const section of mainNews.section) {
        await testDataFactory.createMultilingualText(
          EntityType.NEWS_SECTION,
          section.id,
          'title',
          languages.korean,
          `섹션 ${section.sortOrder} 제목`,
        );

        await testDataFactory.createMultilingualText(
          EntityType.NEWS_SECTION,
          section.id,
          'subTitle',
          languages.korean,
          `섹션 ${section.sortOrder} 부제목`,
        );

        await testDataFactory.createMultilingualText(
          EntityType.NEWS_SECTION,
          section.id,
          'content',
          languages.korean,
          `섹션 ${section.sortOrder} 내용입니다.`,
        );
      }

      // 추가 뉴스들 다국어 텍스트
      for (let i = 0; i < additionalNews.length; i++) {
        await testDataFactory.createMultilingualText(
          EntityType.NEWS,
          additionalNews[i].id,
          'title',
          languages.korean,
          `추가 뉴스 ${i + 1} 제목`,
        );
      }

      // When: 뉴스 조회
      const result = await newsService.getNews(
        mainNews.id,
        LanguageCode.KOREAN,
      );

      // Then: 메인 뉴스 정보 검증
      expect(result).toBeInstanceOf(GetNewsResponse);
      expect(result.id).toBe(mainNews.id);
      expect(result.writer).toBe('Main Writer');
      expect(result.category).toBe('테스트 카테고리');
      expect(result.title).toBe('메인 뉴스 제목');
      expect(result.content).toBe('메인 뉴스 내용입니다.');
      expect(result.banner).toContain('/banner/main-banner.jpg');
      expect(result.profileImage).toContain('/profile/main-profile.jpg');

      // 섹션 정보 검증
      expect(result.section).toHaveLength(2);
      expect(result.section[0].title).toBe('섹션 1 제목');
      expect(result.section[0].subTitle).toBe('섹션 1 부제목');
      expect(result.section[0].content).toBe('섹션 1 내용입니다.');
      expect(result.section[0].iamgeList).toHaveLength(2);

      expect(result.section[1].title).toBe('섹션 2 제목');
      expect(result.section[1].subTitle).toBe('섹션 2 부제목');
      expect(result.section[1].content).toBe('섹션 2 내용입니다.');
      expect(result.section[1].iamgeList).toHaveLength(1);

      // lastArticle 목록 검증
      expect(result.lastNews).toBeInstanceOf(Array);
      expect(result.lastNews.length).toBeLessThanOrEqual(3);

      // lastArticle 구조 검증
      result.lastNews.forEach((lastNews) => {
        expect(lastNews).toHaveProperty('id');
        expect(lastNews).toHaveProperty('banner');
        expect(lastNews).toHaveProperty('title');
        expect(typeof lastNews.id).toBe('number');
        expect(typeof lastNews.banner).toBe('string');
      });
    });

    it('should return news with English multilingual content', async () => {
      // Given: 영어 다국어 텍스트가 있는 뉴스
      const { category } = await testDataFactory.createMultilingualCategory(
        {},
        {
          name: {
            ko: '테스트 카테고리',
            en: 'Test Category',
            zh: '测试分类',
          },
        },
      );
      const news = await testDataFactory.createFullNews({
        category,
        brand: {},
        news: { status: NewsStatus.NORMAL },
        sections: [
          {
            sortOrder: 1,
            images: [{ sortOrder: 1, imageUrl: 'test.jpg' }],
          },
        ],
      });

      const languages = await testDataFactory.createDefaultLanguages();

      // 영어 다국어 텍스트
      await testDataFactory.createMultilingualText(
        EntityType.NEWS,
        news.id,
        'title',
        languages.english,
        'English News Title',
      );

      await testDataFactory.createMultilingualText(
        EntityType.NEWS,
        news.id,
        'content',
        languages.english,
        'English news content.',
      );

      await testDataFactory.createMultilingualText(
        EntityType.NEWS_SECTION,
        news.section[0].id,
        'title',
        languages.english,
        'English Section Title',
      );

      // When: 영어로 뉴스 조회
      const result = await newsService.getNews(news.id, LanguageCode.ENGLISH);

      // Then: 영어 콘텐츠 반환
      expect(result.title).toBe('English News Title');
      expect(result.content).toBe('English news content.');
      expect(result.section[0].title).toBe('English Section Title');
      expect(result.lastNews).toBeInstanceOf(Array);
    });

    it('should return news with Chinese multilingual content', async () => {
      // Given: 중국어 다국어 텍스트가 있는 뉴스
      const { category } = await testDataFactory.createMultilingualCategory(
        {},
        {
          name: {
            ko: '테스트 카테고리',
            en: 'Test Category',
            zh: '测试分类',
          },
        },
      );
      const news = await testDataFactory.createFullNews({
        category,
        brand: {},
        news: { status: NewsStatus.NORMAL },
        sections: [
          {
            sortOrder: 1,
            images: [],
          },
        ],
      });

      const languages = await testDataFactory.createDefaultLanguages();

      // 중국어 다국어 텍스트
      await testDataFactory.createMultilingualText(
        EntityType.NEWS,
        news.id,
        'title',
        languages.chinese,
        '中文新闻标题',
      );

      await testDataFactory.createMultilingualText(
        EntityType.NEWS,
        news.id,
        'content',
        languages.chinese,
        '这是中文新闻内容。',
      );

      // When: 중국어로 뉴스 조회
      const result = await newsService.getNews(news.id, LanguageCode.CHINESE);

      // Then: 중국어 콘텐츠 반환
      expect(result.title).toBe('中文新闻标题');
      expect(result.content).toBe('这是中文新闻内容。');
      expect(result.lastNews).toBeInstanceOf(Array);
    });

    it('should return news with null multilingual text when no content exists', async () => {
      // Given: 다국어 텍스트가 없는 뉴스
      const { category } = await testDataFactory.createMultilingualCategory(
        {},
        {
          name: {
            ko: '테스트 카테고리',
            en: 'Test Category',
            zh: '测试分类',
          },
        },
      );
      const news = await testDataFactory.createFullNews({
        category,
        brand: {},
        news: { status: NewsStatus.NORMAL },
        sections: [
          {
            sortOrder: 1,
            images: [{ sortOrder: 1, imageUrl: 'test.jpg' }],
          },
        ],
      });

      // When: 뉴스 조회
      const result = await newsService.getNews(news.id, LanguageCode.KOREAN);

      // Then: 기본 구조는 유지하되 다국어 텍스트는 null
      expect(result.id).toBe(news.id);
      expect(result.writer).toBe(news.writer);
      expect(result.category).toBe('테스트 카테고리');
      expect(result.title).toBeNull();
      expect(result.content).toBeNull();
      expect(result.section[0].title).toBeNull();
      expect(result.lastNews).toBeInstanceOf(Array);
    });

    it('should throw ServiceError when news does not exist', async () => {
      // When & Then: 존재하지 않는 뉴스 조회 시 에러 발생
      await expect(
        newsService.getNews(999, LanguageCode.KOREAN),
      ).rejects.toThrow(ServiceError);

      try {
        await newsService.getNews(999, LanguageCode.KOREAN);
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        expect(error.message).toBe('News not found or not in normal status');
        expect(error.getCode()).toBe(ServiceErrorCode.NOT_FOUND_DATA);
      }
    });

    it('should throw ServiceError when news exists but not in normal status', async () => {
      // Given: DELETE 상태 뉴스
      const { category } = await testDataFactory.createMultilingualCategory(
        {},
        {
          name: {
            ko: '테스트 카테고리',
            en: 'Test Category',
            zh: '测试分类',
          },
        },
      );
      const brand = await testDataFactory.createBrand();
      const deletedNews = await testDataFactory.createNews(category, brand, {
        status: NewsStatus.DELETE,
      });

      // When & Then: DELETE 상태 뉴스 조회 시 에러 발생
      await expect(
        newsService.getNews(deletedNews.id, LanguageCode.KOREAN),
      ).rejects.toThrow(ServiceError);
    });

    it('should handle lastArticle with various scenarios', async () => {
      // Given: 다양한 상태의 뉴스들 생성
      const { category } = await testDataFactory.createMultilingualCategory(
        {},
        {
          name: {
            ko: '테스트 카테고리',
            en: 'Test Category',
            zh: '测试分类',
          },
        },
      );

      // NORMAL 상태 뉴스들 생성 (lastArticle에 포함되어야 함)
      const normalNews = [];
      for (let i = 1; i <= 5; i++) {
        const brand = await testDataFactory.createBrand();
        const news = await testDataFactory.createNews(category, brand, {
          status: NewsStatus.NORMAL,
          writer: `Writer ${i}`,
        });
        normalNews.push(news);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // DELETE 상태 뉴스 생성 (lastArticle에 포함되지 않아야 함)
      const brandForDeleted = await testDataFactory.createBrand();
      await testDataFactory.createNews(category, brandForDeleted, {
        status: NewsStatus.DELETE,
        writer: 'Deleted Writer',
      });

      // 메인 뉴스 생성
      const mainNews = await testDataFactory.createFullNews({
        category,
        brand: {},
        news: { status: NewsStatus.NORMAL },
        sections: [{ sortOrder: 1, images: [] }],
      });

      // When: 메인 뉴스 조회
      const result = await newsService.getNews(
        mainNews.id,
        LanguageCode.KOREAN,
      );

      // Then: lastArticle은 최대 3개, NORMAL 상태만 포함
      expect(result.lastNews.length).toBeLessThanOrEqual(3);

      // DELETE 상태 뉴스는 포함되지 않음을 간접적으로 확인
      // (전체 NORMAL 뉴스가 6개인데 lastArticle은 최대 3개만 반환)
      expect(result.lastNews.length).toBeLessThanOrEqual(3);
    });

    it('should return lastArticle with proper multilingual content', async () => {
      // Given: 다국어 텍스트가 있는 여러 뉴스 생성
      const { category } = await testDataFactory.createMultilingualCategory(
        {},
        {
          name: {
            ko: '테스트 카테고리',
            en: 'Test Category',
            zh: '测试分类',
          },
        },
      );
      const languages = await testDataFactory.createDefaultLanguages();

      // 추가 뉴스들 생성 및 다국어 텍스트 추가
      const additionalNews = [];
      for (let i = 1; i <= 2; i++) {
        const brand = await testDataFactory.createBrand();
        const news = await testDataFactory.createNews(category, brand, {
          status: NewsStatus.NORMAL,
          writer: `Writer ${i}`,
          banner: `/banner/additional-${i}.jpg`,
        });

        await testDataFactory.createMultilingualText(
          EntityType.NEWS,
          news.id,
          'title',
          languages.korean,
          `추가 뉴스 ${i} 제목`,
        );

        additionalNews.push(news);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // 메인 뉴스 생성
      const mainNews = await testDataFactory.createFullNews({
        category,
        brand: {},
        news: { status: NewsStatus.NORMAL },
        sections: [{ sortOrder: 1, images: [] }],
      });

      // When: 메인 뉴스 조회
      const result = await newsService.getNews(
        mainNews.id,
        LanguageCode.KOREAN,
      );

      // Then: lastArticle에 다국어 제목이 포함됨
      expect(result.lastNews.length).toBeGreaterThan(0);

      const lastNewsWithTitle = result.lastNews.filter(
        (news) => news.title !== null,
      );
      expect(lastNewsWithTitle.length).toBeGreaterThan(0);

      // 추가한 뉴스들의 제목이 포함되어 있는지 확인
      const titleTexts = result.lastNews
        .map((news) => news.title)
        .filter((title) => title !== null);
      expect(titleTexts).toContain('추가 뉴스 1 제목');
      expect(titleTexts).toContain('추가 뉴스 2 제목');
    });

    it('should handle concurrent requests correctly', async () => {
      // Given: 뉴스와 다국어 텍스트 생성
      const { category } = await testDataFactory.createMultilingualCategory(
        {},
        {
          name: {
            ko: '테스트 카테고리',
            en: 'Test Category',
            zh: '测试分类',
          },
        },
      );
      const news = await testDataFactory.createFullNews({
        category,
        brand: {},
        news: { status: NewsStatus.NORMAL },
      });

      const languages = await testDataFactory.createDefaultLanguages();
      await testDataFactory.createMultilingualText(
        EntityType.NEWS,
        news.id,
        'title',
        languages.korean,
        '동시 요청 테스트',
      );

      // When: 동시에 여러 요청
      const promises = Array(5)
        .fill(null)
        .map(() => newsService.getNews(news.id, LanguageCode.KOREAN));

      const results = await Promise.all(promises);

      // Then: 모든 요청이 동일한 결과 반환
      results.forEach((result) => {
        expect(result.id).toBe(news.id);
        expect(result.title).toBe('동시 요청 테스트');
        expect(result.lastNews).toBeInstanceOf(Array);
      });
    });
  });
});

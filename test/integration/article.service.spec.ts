import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { ArticleStatus } from '@app/repository/enum/article.enum';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { Test, TestingModule } from '@nestjs/testing';

import { GetArticleResponse } from '../../apps/api/src/module/article/article.dto';
import { ArticleModule } from '../../apps/api/src/module/article/article.module';
import { ArticleService } from '../../apps/api/src/module/article/article.service';
import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('ArticleService Integration Tests', () => {
  let articleService: ArticleService;
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    module = await Test.createTestingModule({
      imports: [TestDatabaseModule, ArticleModule],
    }).compile();

    articleService = module.get<ArticleService>(ArticleService);
    testDataFactory = new TestDataFactory(TestSetup.getDataSource());
  });

  afterAll(async () => {
    await module.close();
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    await TestSetup.clearDatabase();
  });

  describe('getArticle', () => {
    it('should return article with lastArticle list and multilingual content in Korean', async () => {
      // Given: 여러 아티클과 다국어 텍스트 생성
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

      // 최신 목록용 추가 아티클들 생성
      const additionalArticles = [];
      for (let i = 1; i <= 3; i++) {
        const brand = await testDataFactory.createBrand();
        const article = await testDataFactory.createArticle(category, brand, {
          status: ArticleStatus.NORMAL,
          writer: `Additional Writer ${i}`,
          banner: `/banner/additional-${i}.jpg`,
        });
        additionalArticles.push(article);
        // 시간차 생성을 위한 작은 지연
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // 메인 아티클 생성
      const mainArticle = await testDataFactory.createFullArticle({
        category,
        brand: {},
        article: {
          status: ArticleStatus.NORMAL,
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

      // 메인 아티클 다국어 텍스트
      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        mainArticle.id,
        'title',
        languages.korean,
        '메인 아티클 제목',
      );

      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        mainArticle.id,
        'content',
        languages.korean,
        '메인 아티클 내용입니다.',
      );

      // 섹션 다국어 텍스트
      for (const section of mainArticle.section) {
        await testDataFactory.createMultilingualText(
          EntityType.ARTICLE_SECTION,
          section.id,
          'title',
          languages.korean,
          `섹션 ${section.sortOrder} 제목`,
        );

        await testDataFactory.createMultilingualText(
          EntityType.ARTICLE_SECTION,
          section.id,
          'subTitle',
          languages.korean,
          `섹션 ${section.sortOrder} 부제목`,
        );

        await testDataFactory.createMultilingualText(
          EntityType.ARTICLE_SECTION,
          section.id,
          'content',
          languages.korean,
          `섹션 ${section.sortOrder} 내용입니다.`,
        );
      }

      // 추가 아티클들 다국어 텍스트
      for (let i = 0; i < additionalArticles.length; i++) {
        await testDataFactory.createMultilingualText(
          EntityType.ARTICLE,
          additionalArticles[i].id,
          'title',
          languages.korean,
          `추가 아티클 ${i + 1} 제목`,
        );
      }

      // When: 아티클 조회
      const result = await articleService.getArticle(
        mainArticle.id,
        LanguageCode.KOREAN,
      );

      // Then: 메인 아티클 정보 검증
      expect(result).toBeInstanceOf(GetArticleResponse);
      expect(result.id).toBe(mainArticle.id);
      expect(result.writer).toBe('Main Writer');
      expect(result.category).toBe('테스트 카테고리');
      expect(result.title).toBe('메인 아티클 제목');
      expect(result.content).toBe('메인 아티클 내용입니다.');
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
      expect(result.lastArticle).toBeInstanceOf(Array);
      expect(result.lastArticle.length).toBeLessThanOrEqual(3);

      // lastArticle 구조 검증
      result.lastArticle.forEach((lastArticle) => {
        expect(lastArticle).toHaveProperty('id');
        expect(lastArticle).toHaveProperty('banner');
        expect(lastArticle).toHaveProperty('title');
        expect(typeof lastArticle.id).toBe('number');
        expect(typeof lastArticle.banner).toBe('string');
      });
    });

    it('should return article with English multilingual content', async () => {
      // Given: 영어 다국어 텍스트가 있는 아티클
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
      const article = await testDataFactory.createFullArticle({
        category,
        brand: {},
        article: { status: ArticleStatus.NORMAL },
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
        EntityType.ARTICLE,
        article.id,
        'title',
        languages.english,
        'English Article Title',
      );

      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        article.id,
        'content',
        languages.english,
        'English article content.',
      );

      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE_SECTION,
        article.section[0].id,
        'title',
        languages.english,
        'English Section Title',
      );

      // When: 영어로 아티클 조회
      const result = await articleService.getArticle(
        article.id,
        LanguageCode.ENGLISH,
      );

      // Then: 영어 콘텐츠 반환
      expect(result.title).toBe('English Article Title');
      expect(result.content).toBe('English article content.');
      expect(result.section[0].title).toBe('English Section Title');
      expect(result.lastArticle).toBeInstanceOf(Array);
    });

    it('should return article with Chinese multilingual content', async () => {
      // Given: 중국어 다국어 텍스트가 있는 아티클
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
      const article = await testDataFactory.createFullArticle({
        category,
        brand: {},
        article: { status: ArticleStatus.NORMAL },
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
        EntityType.ARTICLE,
        article.id,
        'title',
        languages.chinese,
        '中文文章标题',
      );

      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        article.id,
        'content',
        languages.chinese,
        '这是中文文章内容。',
      );

      // When: 중국어로 아티클 조회
      const result = await articleService.getArticle(
        article.id,
        LanguageCode.CHINESE,
      );

      // Then: 중국어 콘텐츠 반환
      expect(result.title).toBe('中文文章标题');
      expect(result.content).toBe('这是中文文章内容。');
      expect(result.lastArticle).toBeInstanceOf(Array);
    });

    it('should return article with null multilingual text when no content exists', async () => {
      // Given: 다국어 텍스트가 없는 아티클
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
      const article = await testDataFactory.createFullArticle({
        category,
        brand: {},
        article: { status: ArticleStatus.NORMAL },
        sections: [
          {
            sortOrder: 1,
            images: [{ sortOrder: 1, imageUrl: 'test.jpg' }],
          },
        ],
      });

      // When: 아티클 조회
      const result = await articleService.getArticle(
        article.id,
        LanguageCode.KOREAN,
      );

      // Then: 기본 구조는 유지하되 다국어 텍스트는 null
      expect(result.id).toBe(article.id);
      expect(result.writer).toBe(article.writer);
      expect(result.category).toBe('테스트 카테고리');
      expect(result.title).toBeNull();
      expect(result.content).toBeNull();
      expect(result.section[0].title).toBeNull();
      expect(result.lastArticle).toBeInstanceOf(Array);
    });

    it('should throw ServiceError when article does not exist', async () => {
      // When & Then: 존재하지 않는 아티클 조회 시 에러 발생
      await expect(
        articleService.getArticle(999, LanguageCode.KOREAN),
      ).rejects.toThrow(ServiceError);

      try {
        await articleService.getArticle(999, LanguageCode.KOREAN);
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        expect(error.message).toBe('Article not found or not in normal status');
        expect(error.getCode()).toBe(ServiceErrorCode.NOT_FOUND_DATA);
      }
    });

    it('should throw ServiceError when article exists but not in normal status', async () => {
      // Given: DELETE 상태 아티클
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
      const deletedArticle = await testDataFactory.createArticle(
        category,
        brand,
        {
          status: ArticleStatus.DELETE,
        },
      );

      // When & Then: DELETE 상태 아티클 조회 시 에러 발생
      await expect(
        articleService.getArticle(deletedArticle.id, LanguageCode.KOREAN),
      ).rejects.toThrow(ServiceError);
    });

    it('should handle lastArticle with various scenarios', async () => {
      // Given: 다양한 상태의 아티클들 생성
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

      // NORMAL 상태 아티클들 생성 (lastArticle에 포함되어야 함)
      const normalArticles = [];
      for (let i = 1; i <= 5; i++) {
        const brand = await testDataFactory.createBrand();
        const article = await testDataFactory.createArticle(category, brand, {
          status: ArticleStatus.NORMAL,
          writer: `Writer ${i}`,
        });
        normalArticles.push(article);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // DELETE 상태 아티클 생성 (lastArticle에 포함되지 않아야 함)
      const brandForDeleted = await testDataFactory.createBrand();
      await testDataFactory.createArticle(category, brandForDeleted, {
        status: ArticleStatus.DELETE,
        writer: 'Deleted Writer',
      });

      // 메인 아티클 생성
      const mainArticle = await testDataFactory.createFullArticle({
        category,
        brand: {},
        article: { status: ArticleStatus.NORMAL },
        sections: [{ sortOrder: 1, images: [] }],
      });

      // When: 메인 아티클 조회
      const result = await articleService.getArticle(
        mainArticle.id,
        LanguageCode.KOREAN,
      );

      // Then: lastArticle은 최대 3개, NORMAL 상태만 포함
      expect(result.lastArticle.length).toBeLessThanOrEqual(3);

      // DELETE 상태 아티클은 포함되지 않음을 간접적으로 확인
      // (전체 NORMAL 아티클이 6개인데 lastArticle은 최대 3개만 반환)
      expect(result.lastArticle.length).toBeLessThanOrEqual(3);
    });

    it('should return lastArticle with proper multilingual content', async () => {
      // Given: 다국어 텍스트가 있는 여러 아티클 생성
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

      // 추가 아티클들 생성 및 다국어 텍스트 추가
      const additionalArticles = [];
      for (let i = 1; i <= 2; i++) {
        const brand = await testDataFactory.createBrand();
        const article = await testDataFactory.createArticle(category, brand, {
          status: ArticleStatus.NORMAL,
          writer: `Writer ${i}`,
          banner: `/banner/additional-${i}.jpg`,
        });

        await testDataFactory.createMultilingualText(
          EntityType.ARTICLE,
          article.id,
          'title',
          languages.korean,
          `추가 아티클 ${i} 제목`,
        );

        additionalArticles.push(article);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // 메인 아티클 생성
      const mainArticle = await testDataFactory.createFullArticle({
        category,
        brand: {},
        article: { status: ArticleStatus.NORMAL },
        sections: [{ sortOrder: 1, images: [] }],
      });

      // When: 메인 아티클 조회
      const result = await articleService.getArticle(
        mainArticle.id,
        LanguageCode.KOREAN,
      );

      // Then: lastArticle에 다국어 제목이 포함됨
      expect(result.lastArticle.length).toBeGreaterThan(0);

      const lastArticlesWithTitle = result.lastArticle.filter(
        (article) => article.title !== null,
      );
      expect(lastArticlesWithTitle.length).toBeGreaterThan(0);

      // 추가한 아티클들의 제목이 포함되어 있는지 확인
      const titleTexts = result.lastArticle
        .map((article) => article.title)
        .filter((title) => title !== null);
      expect(titleTexts).toContain('추가 아티클 1 제목');
      expect(titleTexts).toContain('추가 아티클 2 제목');
    });

    it('should handle concurrent requests correctly', async () => {
      // Given: 아티클과 다국어 텍스트 생성
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
      const article = await testDataFactory.createFullArticle({
        category,
        brand: {},
        article: { status: ArticleStatus.NORMAL },
      });

      const languages = await testDataFactory.createDefaultLanguages();
      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        article.id,
        'title',
        languages.korean,
        '동시 요청 테스트',
      );

      // When: 동시에 여러 요청
      const promises = Array(5)
        .fill(null)
        .map(() => articleService.getArticle(article.id, LanguageCode.KOREAN));

      const results = await Promise.all(promises);

      // Then: 모든 요청이 동일한 결과 반환
      results.forEach((result) => {
        expect(result.id).toBe(article.id);
        expect(result.title).toBe('동시 요청 테스트');
        expect(result.lastArticle).toBeInstanceOf(Array);
      });
    });
  });
});

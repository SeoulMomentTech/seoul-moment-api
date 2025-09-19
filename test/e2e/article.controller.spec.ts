import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { HttpExceptionFilter } from '@app/common/exception/http-exception-filter';
import { ServiceErrorFilter } from '@app/common/exception/service-exception-filter';
import { LoggerService } from '@app/common/log/logger.service';
import { ArticleStatus } from '@app/repository/enum/article.enum';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  INestApplication,
  ValidationPipe,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { ArticleModule } from '../../apps/api/src/module/article/article.module';
import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('ArticleController (E2E)', () => {
  let app: INestApplication;
  let testDataFactory: TestDataFactory;
  let moduleFixture: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    moduleFixture = await Test.createTestingModule({
      imports: [ArticleModule, TestDatabaseModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // LoggerService 인스턴스 가져오기
    const logger = moduleFixture.get<LoggerService>(LoggerService);

    // 전역 파이프 및 필터 설정 (main.ts와 동일하게)
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        transform: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        disableErrorMessages: false,
        validationError: {
          target: true,
          value: true,
        },
        exceptionFactory: (errors) => new BadRequestException(errors),
      }),
    );

    app.useGlobalFilters(
      new HttpExceptionFilter(logger),
      new ServiceErrorFilter(logger),
    );

    await app.init();
    testDataFactory = new TestDataFactory(TestSetup.getDataSource());
  });

  afterAll(async () => {
    await app.close();
    await moduleFixture.close();
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    await TestSetup.clearDatabase();
  });

  describe('GET /article/:id', () => {
    it('should return article successfully with Korean language', async () => {
      // Given: 카테고리와 아티클 생성
      const { category } = await testDataFactory.createMultilingualCategory(
        {},
        {
          name: {
            ko: 'Test Category',
            en: 'Test Category',
            zh: '测试分类',
          },
        },
      );

      const article = await testDataFactory.createFullArticle({
        category,
        brand: {},
        article: {
          writer: 'Test Writer',
          status: ArticleStatus.NORMAL,
          banner: '/banner/test-banner.jpg',
          profileImage: '/profile/test-profile.jpg',
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

      // 언어 및 다국어 텍스트 생성
      const languages = await testDataFactory.createDefaultLanguages();

      // Article 다국어 텍스트
      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        article.id,
        'title',
        languages.korean,
        '테스트 아티클 제목',
      );

      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        article.id,
        'content',
        languages.korean,
        '테스트 아티클 내용입니다.',
      );

      // Article Section 다국어 텍스트
      for (const section of article.section) {
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

      // When: API 호출
      const response = await request(app.getHttpServer())
        .get(`/article/${article.id}`)
        .set('Accept-language', LanguageCode.KOREAN)
        .expect(200);

      // Then: 응답 검증
      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('data');

      const data = response.body.data;
      expect(data.id).toBe(article.id);
      expect(data.writer).toBe('Test Writer');
      expect(data.title).toBe('테스트 아티클 제목');
      expect(data.content).toBe('테스트 아티클 내용입니다.');
      expect(data.banner).toContain('/banner/test-banner.jpg');
      expect(data.profileImage).toContain('/profile/test-profile.jpg');

      // LastArticle 검증 (최신 3개 아티클 목록)
      expect(data.lastArticle).toBeInstanceOf(Array);
      expect(data.lastArticle.length).toBeLessThanOrEqual(3);
      // 현재 아티클이 포함되어 있을 수 있음
      if (data.lastArticle.length > 0) {
        expect(data.lastArticle[0]).toHaveProperty('id');
        expect(data.lastArticle[0]).toHaveProperty('banner');
        expect(data.lastArticle[0]).toHaveProperty('title');
      }

      // Section 검증
      expect(data.section).toHaveLength(2);
      expect(data.section[0].title).toBe('섹션 1 제목');
      expect(data.section[0].subTitle).toBe('섹션 1 부제목');
      expect(data.section[0].content).toBe('섹션 1 내용입니다.');
      expect(data.section[0].iamgeList).toHaveLength(2);

      expect(data.section[1].title).toBe('섹션 2 제목');
      expect(data.section[1].subTitle).toBe('섹션 2 부제목');
      expect(data.section[1].content).toBe('섹션 2 내용입니다.');
      expect(data.section[1].iamgeList).toHaveLength(1);
    });

    it('should return article successfully with English language', async () => {
      // Given: 카테고리와 아티클 생성
      const { category } = await testDataFactory.createMultilingualCategory(
        {},
        {
          name: {
            ko: 'Test Category',
            en: 'Test Category',
            zh: '测试分类',
          },
        },
      );

      const article = await testDataFactory.createFullArticle({
        category,
        brand: {},
        article: {
          writer: 'Test Writer',
          status: ArticleStatus.NORMAL,
        },
        sections: [
          {
            sortOrder: 1,
            images: [{ sortOrder: 1, imageUrl: '/section/image1.jpg' }],
          },
        ],
      });

      // 언어 및 다국어 텍스트 생성
      const languages = await testDataFactory.createDefaultLanguages();

      // Article 영어 다국어 텍스트
      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        article.id,
        'title',
        languages.english,
        'Test Article Title',
      );

      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        article.id,
        'content',
        languages.english,
        'This is test article content.',
      );

      // Article Section 영어 다국어 텍스트
      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE_SECTION,
        article.section[0].id,
        'title',
        languages.english,
        'Section 1 Title',
      );

      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE_SECTION,
        article.section[0].id,
        'subTitle',
        languages.english,
        'Section 1 Subtitle',
      );

      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE_SECTION,
        article.section[0].id,
        'content',
        languages.english,
        'This is section 1 content.',
      );

      // When: API 호출 (영어)
      const response = await request(app.getHttpServer())
        .get(`/article/${article.id}`)
        .set('Accept-language', LanguageCode.ENGLISH)
        .expect(200);

      // Then: 응답 검증
      expect(response.body).toHaveProperty('result', true);
      const data = response.body.data;
      expect(data.title).toBe('Test Article Title');
      expect(data.content).toBe('This is test article content.');
      expect(data.section[0].title).toBe('Section 1 Title');
      expect(data.section[0].subTitle).toBe('Section 1 Subtitle');
      expect(data.section[0].content).toBe('This is section 1 content.');

      // LastArticle 검증
      expect(data.lastArticle).toBeInstanceOf(Array);
      expect(data.lastArticle.length).toBeLessThanOrEqual(3);
    });

    it('should return article successfully with Chinese language', async () => {
      // Given: 카테고리와 아티클 생성
      const { category } = await testDataFactory.createMultilingualCategory(
        {},
        {
          name: {
            ko: 'Test Category',
            en: 'Test Category',
            zh: '测试分类',
          },
        },
      );

      const article = await testDataFactory.createFullArticle({
        category,
        brand: {},
        article: {
          writer: 'Test Writer',
          status: ArticleStatus.NORMAL,
        },
        sections: [
          {
            sortOrder: 1,
            images: [],
          },
        ],
      });

      // 언어 및 다국어 텍스트 생성
      const languages = await testDataFactory.createDefaultLanguages();

      // Article 중국어 다국어 텍스트
      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        article.id,
        'title',
        languages.chinese,
        '测试文章标题',
      );

      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        article.id,
        'content',
        languages.chinese,
        '这是测试文章内容。',
      );

      // Article Section 중국어 다국어 텍스트
      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE_SECTION,
        article.section[0].id,
        'title',
        languages.chinese,
        '第1节标题',
      );

      // When: API 호출 (중국어)
      const response = await request(app.getHttpServer())
        .get(`/article/${article.id}`)
        .set('Accept-language', LanguageCode.CHINESE)
        .expect(200);

      // Then: 응답 검증
      expect(response.body).toHaveProperty('result', true);
      const data = response.body.data;
      expect(data.title).toBe('测试文章标题');
      expect(data.content).toBe('这是测试文章内容。');
      expect(data.section[0].title).toBe('第1节标题');

      // LastArticle 검증
      expect(data.lastArticle).toBeInstanceOf(Array);
      expect(data.lastArticle.length).toBeLessThanOrEqual(3);
    });

    it('should return 404 when article not found', async () => {
      // Given: 존재하지 않는 아티클 ID
      const nonExistentId = 99999;

      // When: API 호출
      const response = await request(app.getHttpServer())
        .get(`/article/${nonExistentId}`)
        .set('Accept-language', LanguageCode.KOREAN)
        .expect(404);

      // Then: 에러 응답 검증
      expect(response.body).toHaveProperty(
        'code',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
      expect(response.body).toHaveProperty(
        'message',
        'Article not found or not in normal status',
      );
    });

    it('should return 404 when article exists but not in normal status', async () => {
      // Given: DELETE 상태의 아티클 생성
      const { category } = await testDataFactory.createMultilingualCategory(
        {},
        {
          name: {
            ko: 'Test Category',
            en: 'Test Category',
            zh: '测试分类',
          },
        },
      );
      const brand = await testDataFactory.createBrand();
      const article = await testDataFactory.createArticle(category, brand, {
        writer: 'Test Writer',
        status: ArticleStatus.DELETE,
      });

      // When: API 호출
      const response = await request(app.getHttpServer())
        .get(`/article/${article.id}`)
        .set('Accept-language', LanguageCode.KOREAN)
        .expect(404);

      // Then: 에러 응답 검증
      expect(response.body).toHaveProperty(
        'code',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
      expect(response.body).toHaveProperty(
        'message',
        'Article not found or not in normal status',
      );
    });

    it('should return 400 when invalid article ID is provided', async () => {
      // Given: 잘못된 ID 형식
      const invalidId = 'invalid-id';

      // When: API 호출
      const response = await request(app.getHttpServer())
        .get(`/article/${invalidId}`)
        .set('Accept-language', LanguageCode.KOREAN)
        .expect(400);

      // Then: ValidationPipe 에러 검증
      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body).toHaveProperty(
        'message',
        'Validation failed (numeric string is expected)',
      );
      expect(response.body).toHaveProperty('error', 'Bad Request');
    });

    it('should handle missing Accept-language header gracefully', async () => {
      // Given: 카테고리와 아티클 생성
      const { category } = await testDataFactory.createMultilingualCategory(
        {},
        {
          name: {
            ko: 'Test Category',
            en: 'Test Category',
            zh: '测试分类',
          },
        },
      );
      const brand = await testDataFactory.createBrand();
      const article = await testDataFactory.createArticle(category, brand, {
        writer: 'Test Writer',
        status: ArticleStatus.NORMAL,
      });

      // When: Accept-language 헤더 없이 API 호출
      const response = await request(app.getHttpServer())
        .get(`/article/${article.id}`)
        .expect(200);

      // Then: 기본적으로 처리됨 (undefined 언어로 처리)
      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('data');
    });

    it('should return lastArticle list with proper structure', async () => {
      // Given: 여러개의 아티클 생성 (최신 목록 확인용)
      const { category } = await testDataFactory.createMultilingualCategory(
        {},
        {
          name: {
            ko: 'Test Category',
            en: 'Test Category',
            zh: '测试分类',
          },
        },
      );

      // 3개의 아티클을 생성하여 lastArticle 목록 테스트
      const articles = [];
      for (let i = 1; i <= 3; i++) {
        const brand = await testDataFactory.createBrand();
        const article = await testDataFactory.createArticle(category, brand, {
          writer: `Writer ${i}`,
          status: ArticleStatus.NORMAL,
          banner: `/banner/test-banner-${i}.jpg`,
        });
        articles.push(article);
      }

      // 메인 아티클 생성
      const mainArticle = await testDataFactory.createFullArticle({
        category,
        brand: {},
        article: {
          writer: 'Main Writer',
          status: ArticleStatus.NORMAL,
        },
        sections: [
          {
            sortOrder: 1,
            images: [],
          },
        ],
      });

      // 언어 및 다국어 텍스트 생성
      const languages = await testDataFactory.createDefaultLanguages();

      // 각 아티클에 다국어 텍스트 추가
      for (let i = 0; i < articles.length; i++) {
        await testDataFactory.createMultilingualText(
          EntityType.ARTICLE,
          articles[i].id,
          'title',
          languages.korean,
          `아티클 ${i + 1} 제목`,
        );
      }

      // 메인 아티클에도 다국어 텍스트 추가
      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        mainArticle.id,
        'title',
        languages.korean,
        '메인 아티클 제목',
      );

      // When: API 호출
      const response = await request(app.getHttpServer())
        .get(`/article/${mainArticle.id}`)
        .set('Accept-language', LanguageCode.KOREAN)
        .expect(200);

      // Then: lastArticle 구조 상세 검증
      expect(response.body).toHaveProperty('result', true);
      const data = response.body.data;

      expect(data.lastArticle).toBeInstanceOf(Array);
      expect(data.lastArticle.length).toBeLessThanOrEqual(3);

      // 각 lastArticle 항목 구조 검증
      data.lastArticle.forEach((lastArticle: any) => {
        expect(lastArticle).toHaveProperty('id');
        expect(typeof lastArticle.id).toBe('number');
        expect(lastArticle).toHaveProperty('banner');
        expect(typeof lastArticle.banner).toBe('string');
        expect(lastArticle).toHaveProperty('title');
        // title은 다국어 텍스트에 따라 문자열이거나 null일 수 있음
        expect(['string', 'object']).toContain(typeof lastArticle.title);
      });
    });

    it('should handle article without multilingual text', async () => {
      // Given: 다국어 텍스트가 없는 아티클 생성
      const { category } = await testDataFactory.createMultilingualCategory(
        {},
        {
          name: {
            ko: 'Test Category',
            en: 'Test Category',
            zh: '测试分类',
          },
        },
      );
      const article = await testDataFactory.createFullArticle({
        category,
        brand: {},
        article: {
          writer: 'Test Writer',
          status: ArticleStatus.NORMAL,
        },
        sections: [
          {
            sortOrder: 1,
            images: [{ sortOrder: 1, imageUrl: '/section/image1.jpg' }],
          },
        ],
      });

      // When: API 호출
      const response = await request(app.getHttpServer())
        .get(`/article/${article.id}`)
        .set('Accept-language', LanguageCode.KOREAN)
        .expect(200);

      // Then: 다국어 텍스트가 없어도 기본 구조 반환
      expect(response.body).toHaveProperty('result', true);
      const data = response.body.data;
      expect(data.id).toBe(article.id);
      expect(data.writer).toBe('Test Writer');
      expect(data.section).toHaveLength(1);
      expect(data.section[0].iamgeList).toHaveLength(1);

      // LastArticle 검증 (다국어 텍스트가 없어도 배열 구조는 유지)
      expect(data.lastArticle).toBeInstanceOf(Array);
      expect(data.lastArticle.length).toBeLessThanOrEqual(3);

      // 다국어 텍스트가 없으면 빈 문자열이나 undefined 반환
      expect(data.title).toBeNull();
      expect(data.content).toBeNull();
    });
  });
});

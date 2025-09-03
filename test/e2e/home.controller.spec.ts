import { HttpExceptionFilter } from '@app/common/exception/http-exception-filter';
import { ServiceErrorFilter } from '@app/common/exception/service-exception-filter';
import { LoggerService } from '@app/common/log/logger.service';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  BadRequestException,
  HttpStatus,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { HomeModule } from '../../apps/api/src/module/home/home.module';
import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('HomeController (E2E)', () => {
  let app: INestApplication;
  let testDataFactory: TestDataFactory;
  let moduleFixture: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    moduleFixture = await Test.createTestingModule({
      imports: [HomeModule, TestDatabaseModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    const logger = moduleFixture.get<LoggerService>(LoggerService);

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

  describe('GET /home', () => {
    it('should return empty home data with proper structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/home')
        .set('Accept-language', LanguageCode.KOREAN)
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.banner).toEqual([]);
      expect(response.body.data.section).toEqual([]);
      expect(response.body.data.news).toEqual([]);
      expect(response.body.data.article).toEqual([]);
    });

    it('should return home data with banners only', async () => {
      // Create home banners
      await testDataFactory.createFullHome({
        banners: [
          { sortOrder: 1, imageUrl: '/banner1.jpg' },
          { sortOrder: 2, imageUrl: '/banner2.jpg' },
        ],
        sections: [],
      });

      const response = await request(app.getHttpServer())
        .get('/home')
        .set('Accept-language', LanguageCode.KOREAN)
        .expect(200);

      expect(response.body.result).toBe(true);
      expect(response.body.data.banner).toHaveLength(2);
      expect(response.body.data.banner[0]).toBe(
        'https://image-dev.seoulmoment.com.tw/banner1.jpg',
      );
      expect(response.body.data.banner[1]).toBe(
        'https://image-dev.seoulmoment.com.tw/banner2.jpg',
      );
      expect(response.body.data.section).toEqual([]);
      expect(response.body.data.news).toEqual([]);
      expect(response.body.data.article).toEqual([]);
    });

    it('should return home data with sections and multilingual content', async () => {
      // Create section with multilingual content
      const { section, languages } =
        await testDataFactory.createMultilingualHomeSection(
          {
            sortOrder: 1,
            url: 'https://example.com/section1',
            urlName: 'Section 1',
          },
          {
            title: {
              [LanguageCode.KOREAN]: '한국어 제목',
              [LanguageCode.ENGLISH]: 'English Title',
            },
            description: {
              [LanguageCode.KOREAN]: '한국어 설명',
              [LanguageCode.ENGLISH]: 'English Description',
            },
          },
        );

      // Add section images
      await testDataFactory.createHomeSectionImage(section, {
        imageUrl: '/section-image1.jpg',
        sortOrder: 1,
      });
      await testDataFactory.createHomeSectionImage(section, {
        imageUrl: '/section-image2.jpg',
        sortOrder: 2,
      });

      // Test Korean content
      const koreanResponse = await request(app.getHttpServer())
        .get('/home')
        .set('Accept-language', LanguageCode.KOREAN)
        .expect(200);

      expect(koreanResponse.body.data.section).toHaveLength(1);
      expect(koreanResponse.body.data.section[0].title).toBe('한국어 제목');
      expect(koreanResponse.body.data.section[0].description).toBe(
        '한국어 설명',
      );
      expect(koreanResponse.body.data.section[0].url).toBe(
        'https://example.com/section1',
      );
      expect(koreanResponse.body.data.section[0].image).toHaveLength(2);
      expect(koreanResponse.body.data.section[0].image).toContain(
        'https://image-dev.seoulmoment.com.tw/section-image1.jpg',
      );
      expect(koreanResponse.body.data.section[0].image).toContain(
        'https://image-dev.seoulmoment.com.tw/section-image2.jpg',
      );

      // Test English content
      const englishResponse = await request(app.getHttpServer())
        .get('/home')
        .set('Accept-language', LanguageCode.ENGLISH)
        .expect(200);

      expect(englishResponse.body.data.section[0].title).toBe('English Title');
      expect(englishResponse.body.data.section[0].description).toBe(
        'English Description',
      );
    });

    it('should return home data with news', async () => {
      // Create news
      const brand = await testDataFactory.createBrand();
      const news = await testDataFactory.createFullNews({
        brand,
        news: { writer: 'News Writer', banner: '/news-banner.jpg' },
        sections: [],
      });

      // Create multilingual text for news
      const languages = await testDataFactory.createDefaultLanguages();
      await testDataFactory.createMultilingualText(
        EntityType.NEWS,
        news.id,
        'title',
        languages.korean,
        '뉴스 제목',
      );
      await testDataFactory.createMultilingualText(
        EntityType.NEWS,
        news.id,
        'content',
        languages.korean,
        '뉴스 내용',
      );

      const response = await request(app.getHttpServer())
        .get('/home')
        .set('Accept-language', LanguageCode.KOREAN)
        .expect(200);

      expect(response.body.data.news).toHaveLength(1);
      expect(response.body.data.news[0].id).toBe(news.id);
      expect(response.body.data.news[0].title).toBe('뉴스 제목');
      expect(response.body.data.news[0].content).toBe('뉴스 내용');
      expect(response.body.data.news[0].writer).toBe('News Writer');
      expect(response.body.data.news[0].image).toBe(
        'https://image-dev.seoulmoment.com.tw/news-banner.jpg',
      );
      expect(response.body.data.news[0]).toHaveProperty('createDate');
    });

    it('should return home data with articles', async () => {
      // Create article
      const brand = await testDataFactory.createBrand();
      const article = await testDataFactory.createFullArticle({
        brand,
        article: { writer: 'Article Writer', banner: '/article-banner.jpg' },
        sections: [],
      });

      // Create multilingual text for article
      const languages = await testDataFactory.createDefaultLanguages();
      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        article.id,
        'title',
        languages.korean,
        '아티클 제목',
      );
      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        article.id,
        'content',
        languages.korean,
        '아티클 내용',
      );

      const response = await request(app.getHttpServer())
        .get('/home')
        .set('Accept-language', LanguageCode.KOREAN)
        .expect(200);

      expect(response.body.data.article).toHaveLength(1);
      expect(response.body.data.article[0].id).toBe(article.id);
      expect(response.body.data.article[0].title).toBe('아티클 제목');
      expect(response.body.data.article[0].content).toBe('아티클 내용');
      expect(response.body.data.article[0].writer).toBe('Article Writer');
      expect(response.body.data.article[0].image).toBe(
        'https://image-dev.seoulmoment.com.tw/article-banner.jpg',
      );
      expect(response.body.data.article[0]).toHaveProperty('createDate');
    });

    it('should return complete home data with all components', async () => {
      // Create banners
      await testDataFactory.createFullHome({
        banners: [
          { sortOrder: 1, imageUrl: '/banner1.jpg' },
          { sortOrder: 2, imageUrl: '/banner2.jpg' },
        ],
        sections: [],
      });

      // Create section with multilingual content
      const { section, languages } =
        await testDataFactory.createMultilingualHomeSection(
          {
            sortOrder: 1,
            url: 'https://example.com/section1',
            urlName: 'Section 1',
          },
          {
            title: { [LanguageCode.KOREAN]: '섹션 제목' },
            description: { [LanguageCode.KOREAN]: '섹션 설명' },
          },
        );

      // Add section image
      await testDataFactory.createHomeSectionImage(section, {
        imageUrl: '/section-image1.jpg',
        sortOrder: 1,
      });

      // Create news
      const brand = await testDataFactory.createBrand();
      const news = await testDataFactory.createFullNews({
        brand,
        news: { writer: 'News Writer', banner: '/news-banner.jpg' },
        sections: [],
      });
      await testDataFactory.createMultilingualText(
        EntityType.NEWS,
        news.id,
        'title',
        languages.korean,
        '뉴스 제목',
      );
      await testDataFactory.createMultilingualText(
        EntityType.NEWS,
        news.id,
        'content',
        languages.korean,
        '뉴스 내용',
      );

      // Create article
      const article = await testDataFactory.createFullArticle({
        brand,
        article: { writer: 'Article Writer', banner: '/article-banner.jpg' },
        sections: [],
      });
      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        article.id,
        'title',
        languages.korean,
        '아티클 제목',
      );
      await testDataFactory.createMultilingualText(
        EntityType.ARTICLE,
        article.id,
        'content',
        languages.korean,
        '아티클 내용',
      );

      const response = await request(app.getHttpServer())
        .get('/home')
        .set('Accept-language', LanguageCode.KOREAN)
        .expect(200);

      // Verify all components
      expect(response.body.result).toBe(true);
      expect(response.body.data.banner).toHaveLength(2);
      expect(response.body.data.section).toHaveLength(1);
      expect(response.body.data.section[0].title).toBe('섹션 제목');
      expect(response.body.data.news).toHaveLength(1);
      expect(response.body.data.news[0].title).toBe('뉴스 제목');
      expect(response.body.data.article).toHaveLength(1);
      expect(response.body.data.article[0].title).toBe('아티클 제목');
    });

    it('should limit news to 3 items and articles to 2 items', async () => {
      // Create 5 news and 4 articles to test pagination
      const languages = await testDataFactory.createDefaultLanguages();

      // Create brand first
      const brand = await testDataFactory.createBrand();

      // Create 5 news
      for (let i = 1; i <= 5; i++) {
        const news = await testDataFactory.createFullNews({
          brand,
          news: { writer: `Writer ${i}`, banner: `/news${i}-banner.jpg` },
          sections: [],
        });
        await testDataFactory.createMultilingualText(
          EntityType.NEWS,
          news.id,
          'title',
          languages.korean,
          `뉴스 ${i} 제목`,
        );
        await testDataFactory.createMultilingualText(
          EntityType.NEWS,
          news.id,
          'content',
          languages.korean,
          `뉴스 ${i} 내용`,
        );
      }

      // Create 4 articles
      for (let i = 1; i <= 4; i++) {
        const article = await testDataFactory.createFullArticle({
          brand,
          article: { writer: `Writer ${i}`, banner: `/article${i}-banner.jpg` },
          sections: [],
        });
        await testDataFactory.createMultilingualText(
          EntityType.ARTICLE,
          article.id,
          'title',
          languages.korean,
          `아티클 ${i} 제목`,
        );
        await testDataFactory.createMultilingualText(
          EntityType.ARTICLE,
          article.id,
          'content',
          languages.korean,
          `아티클 ${i} 내용`,
        );
      }

      const response = await request(app.getHttpServer())
        .get('/home')
        .set('Accept-language', LanguageCode.KOREAN)
        .expect(200);

      // Should return only 3 news (latest)
      expect(response.body.data.news).toHaveLength(3);
      expect(response.body.data.news[0].title).toBe('뉴스 5 제목'); // Latest first
      expect(response.body.data.news[1].title).toBe('뉴스 4 제목');
      expect(response.body.data.news[2].title).toBe('뉴스 3 제목');

      // Should return only 2 articles (latest)
      expect(response.body.data.article).toHaveLength(2);
      expect(response.body.data.article[0].title).toBe('아티클 4 제목'); // Latest first
      expect(response.body.data.article[1].title).toBe('아티클 3 제목');
    });

    it('should return 400 when Accept-language header is missing', async () => {
      const response = await request(app.getHttpServer())
        .get('/home')
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body).toHaveProperty('error', 'Bad Request');
    });

    it('should handle different language codes correctly', async () => {
      // Create section with all language content
      const { section } = await testDataFactory.createMultilingualHomeSection(
        {
          sortOrder: 1,
          url: 'https://example.com/section1',
          urlName: 'Section 1',
        },
        {
          title: {
            [LanguageCode.KOREAN]: '한국어 제목',
            [LanguageCode.ENGLISH]: 'English Title',
            [LanguageCode.CHINESE]: '中文标题',
          },
        },
      );

      // Test all supported languages
      const languages = [
        { code: LanguageCode.KOREAN, expectedTitle: '한국어 제목' },
        { code: LanguageCode.ENGLISH, expectedTitle: 'English Title' },
        { code: LanguageCode.CHINESE, expectedTitle: '中文标题' },
      ];

      for (const { code, expectedTitle } of languages) {
        const response = await request(app.getHttpServer())
          .get('/home')
          .set('Accept-language', code)
          .expect(200);

        expect(response.body.data.section[0].title).toBe(expectedTitle);
      }
    });
  });
});

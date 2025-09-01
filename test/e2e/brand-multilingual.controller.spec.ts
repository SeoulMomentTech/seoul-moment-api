import { INestApplication, ValidationPipe, HttpStatus, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { BrandModule } from '../../apps/api/src/module/brand/brand.module';
import { HttpExceptionFilter } from '@app/common/exception/http-exception-filter';
import { ServiceErrorFilter } from '@app/common/exception/service-exception-filter';
import { LoggerService } from '@app/common/log/logger.service';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('BrandController Multilingual (E2E)', () => {
  let app: INestApplication;
  let testDataFactory: TestDataFactory;
  let moduleFixture: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    moduleFixture = await Test.createTestingModule({
      imports: [BrandModule, TestDatabaseModule],
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

  describe('GET /brand/introduce/:id with multilingual support', () => {
    it('should return Korean content by default', async () => {
      // Given: Create multilingual brand
      const { brand } = await testDataFactory.createMultilingualBrand(
        { status: 'NORMAL' },
        {
          name: {
            [LanguageCode.KOREAN]: '서울모먼트',
            [LanguageCode.ENGLISH]: 'Seoul Moment',
          },
          description: {
            [LanguageCode.KOREAN]: '서울의 특별한 순간들',
            [LanguageCode.ENGLISH]: 'Special moments of Seoul',
          },
        },
      );

      // When: Request without language parameter
      const response = await request(app.getHttpServer())
        .get(`/brand/introduce/${brand.id}`)
        .expect(200);

      // Then: Should return Korean content
      expect(response.body).toHaveProperty('result', true);
      expect(response.body.data.name).toBe('서울모먼트');
      expect(response.body.data.description).toBe('서울의 특별한 순간들');
    });

    it('should return content in specified language via query parameter', async () => {
      // Given: Create multilingual brand
      const { brand } = await testDataFactory.createMultilingualBrand(
        { status: 'NORMAL' },
        {
          name: {
            [LanguageCode.KOREAN]: '서울모먼트',
            [LanguageCode.ENGLISH]: 'Seoul Moment',
            [LanguageCode.CHINESE]: '首尔时刻',
          },
          description: {
            [LanguageCode.KOREAN]: '서울의 특별한 순간들',
            [LanguageCode.ENGLISH]: 'Special moments of Seoul',
            [LanguageCode.CHINESE]: '首尔的特殊时刻',
          },
        },
      );

      // When: Request English content
      const englishResponse = await request(app.getHttpServer())
        .get(`/brand/introduce/${brand.id}?lang=en`)
        .expect(200);

      // Then: Should return English content
      expect(englishResponse.body.data.name).toBe('Seoul Moment');
      expect(englishResponse.body.data.description).toBe('Special moments of Seoul');

      // When: Request Chinese content
      const chineseResponse = await request(app.getHttpServer())
        .get(`/brand/introduce/${brand.id}?lang=zh`)
        .expect(200);

      // Then: Should return Chinese content
      expect(chineseResponse.body.data.name).toBe('首尔时刻');
      expect(chineseResponse.body.data.description).toBe('首尔的特殊时刻');
    });

    it('should return content based on Accept-Language header', async () => {
      // Given: Create multilingual brand
      const { brand } = await testDataFactory.createMultilingualBrand(
        { status: 'NORMAL' },
        {
          name: {
            [LanguageCode.KOREAN]: '서울모먼트',
            [LanguageCode.ENGLISH]: 'Seoul Moment',
          },
        },
      );

      // When: Request with Accept-Language header
      const response = await request(app.getHttpServer())
        .get(`/brand/introduce/${brand.id}`)
        .set('Accept-Language', 'en-US,en;q=0.9')
        .expect(200);

      // Then: Should return English content
      expect(response.body.data.name).toBe('Seoul Moment');
    });

    it('should prioritize query parameter over Accept-Language header', async () => {
      // Given: Create multilingual brand
      const { brand } = await testDataFactory.createMultilingualBrand(
        { status: 'NORMAL' },
        {
          name: {
            [LanguageCode.KOREAN]: '서울모먼트',
            [LanguageCode.ENGLISH]: 'Seoul Moment',
            [LanguageCode.CHINESE]: '首尔时刻',
          },
        },
      );

      // When: Request with both query param and header (query should win)
      const response = await request(app.getHttpServer())
        .get(`/brand/introduce/${brand.id}?lang=zh`)
        .set('Accept-Language', 'en-US')
        .expect(200);

      // Then: Should return Chinese content (query param priority)
      expect(response.body.data.name).toBe('首尔时刻');
    });

    it('should fallback to Korean for unsupported language codes', async () => {
      // Given: Create multilingual brand
      const { brand } = await testDataFactory.createMultilingualBrand(
        { status: 'NORMAL' },
        {
          name: {
            [LanguageCode.KOREAN]: '서울모먼트',
            [LanguageCode.ENGLISH]: 'Seoul Moment',
          },
        },
      );

      // When: Request with unsupported language
      const response = await request(app.getHttpServer())
        .get(`/brand/introduce/${brand.id}?lang=fr`)
        .expect(200);

      // Then: Should return Korean content (fallback)
      expect(response.body.data.name).toBe('서울모먼트');
    });

    it('should handle multilingual sections correctly', async () => {
      // Given: Create brand with multilingual sections
      const brand = await testDataFactory.createFullBrand({
        brand: { status: 'NORMAL' },
        sections: [
          {
            sortOrder: 1,
            images: [{ sortOrder: 1, imageUrl: 'section1.jpg' }],
          },
        ],
      });

      const languages = await testDataFactory.createDefaultLanguages();
      const sectionId = brand.brandSectionList[0].id;

      // Create multilingual content
      await Promise.all([
        testDataFactory.createMultilingualText(
          'Brand',
          brand.id,
          'name',
          languages.korean,
          '서울모먼트',
        ),
        testDataFactory.createMultilingualText(
          'Brand',
          brand.id,
          'name',
          languages.english,
          'Seoul Moment',
        ),
        testDataFactory.createMultilingualText(
          'BrandSection',
          sectionId,
          'title',
          languages.korean,
          '브랜드 스토리',
        ),
        testDataFactory.createMultilingualText(
          'BrandSection',
          sectionId,
          'content',
          languages.korean,
          '우리의 이야기입니다.',
        ),
        testDataFactory.createMultilingualText(
          'BrandSection',
          sectionId,
          'title',
          languages.english,
          'Brand Story',
        ),
      ]);

      // When: Request in Korean
      const koreanResponse = await request(app.getHttpServer())
        .get(`/brand/introduce/${brand.id}?lang=ko`)
        .expect(200);

      // Then: Should return Korean section content
      expect(koreanResponse.body.data.name).toBe('서울모먼트');
      expect(koreanResponse.body.data.section).toHaveLength(1);
      expect(koreanResponse.body.data.section[0].title).toBe('브랜드 스토리');
      expect(koreanResponse.body.data.section[0].content).toBe('우리의 이야기입니다.');
      expect(koreanResponse.body.data.section[0].imageList).toEqual(['section1.jpg']);

      // When: Request in English
      const englishResponse = await request(app.getHttpServer())
        .get(`/brand/introduce/${brand.id}?lang=en`)
        .expect(200);

      // Then: Should return mixed content with fallbacks
      expect(englishResponse.body.data.name).toBe('Seoul Moment');
      expect(englishResponse.body.data.section[0].title).toBe('Brand Story');
      expect(englishResponse.body.data.section[0].content).toBe('우리의 이야기입니다.'); // Fallback to Korean
    });

    it('should handle various Accept-Language header formats', async () => {
      // Given: Create multilingual brand
      const { brand } = await testDataFactory.createMultilingualBrand(
        { status: 'NORMAL' },
        {
          name: {
            [LanguageCode.KOREAN]: '서울모먼트',
            [LanguageCode.ENGLISH]: 'Seoul Moment',
            [LanguageCode.CHINESE]: '首尔时刻',
          },
        },
      );

      // Test various header formats
      const testCases = [
        { header: 'ko', expected: '서울모먼트' },
        { header: 'ko-KR', expected: '서울모먼트' },
        { header: 'en', expected: 'Seoul Moment' },
        { header: 'en-US', expected: 'Seoul Moment' },
        { header: 'zh', expected: '首尔时刻' },
        { header: 'zh-CN', expected: '首尔时刻' },
        { header: 'cn', expected: '首尔时刻' },
        { header: 'fr-FR', expected: '서울모먼트' }, // Fallback to Korean
      ];

      for (const testCase of testCases) {
        const response = await request(app.getHttpServer())
          .get(`/brand/introduce/${brand.id}`)
          .set('Accept-Language', testCase.header)
          .expect(200);

        expect(response.body.data.name).toBe(testCase.expected);
      }
    });

    it('should return 404 for non-existent brand', async () => {
      // When: Request non-existent brand
      const response = await request(app.getHttpServer())
        .get('/brand/introduce/999?lang=ko')
        .expect(404);

      // Then: Should return error
      expect(response.body).toHaveProperty('code');
      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 for blocked brand', async () => {
      // Given: Create blocked brand
      const { brand } = await testDataFactory.createMultilingualBrand(
        { status: 'BLOCK' },
        {
          name: { [LanguageCode.KOREAN]: '차단된 브랜드' },
        },
      );

      // When: Request blocked brand
      const response = await request(app.getHttpServer())
        .get(`/brand/introduce/${brand.id}?lang=ko`)
        .expect(404);

      // Then: Should return error
      expect(response.body).toHaveProperty('code');
    });

    it('should return 400 for invalid brand ID', async () => {
      // When: Request with invalid ID
      const response = await request(app.getHttpServer())
        .get('/brand/introduce/invalid-id?lang=ko')
        .expect(400);

      // Then: Should return validation error
      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle empty multilingual content gracefully', async () => {
      // Given: Create brand without multilingual content
      const brand = await testDataFactory.createBrand({ status: 'NORMAL' });

      // When: Request brand
      const response = await request(app.getHttpServer())
        .get(`/brand/introduce/${brand.id}?lang=en`)
        .expect(200);

      // Then: Should return empty strings
      expect(response.body.data.name).toBe('');
      expect(response.body.data.description).toBe('');
      expect(response.body.data.section).toEqual([]);
      expect(response.body.data.bannerList).toEqual([]);
    });
  });
});
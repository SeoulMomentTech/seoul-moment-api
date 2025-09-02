import { HttpExceptionFilter } from '@app/common/exception/http-exception-filter';
import { ServiceErrorFilter } from '@app/common/exception/service-exception-filter';
import { LoggerService } from '@app/common/log/logger.service';
import { BrandStatus } from '@app/repository/enum/brand.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  INestApplication,
  ValidationPipe,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { BrandModule } from '../../apps/api/src/module/brand/brand.module';
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

  describe('GET /brand/:id with multilingual support', () => {
    it('should return content based on Accept-Language header', async () => {
      // Given: Create multilingual brand
      const { brand } = await testDataFactory.createMultilingualBrand(
        { status: BrandStatus.NORMAL },
        {
          name: {
            [LanguageCode.KOREAN]: '서울모먼트',
            [LanguageCode.ENGLISH]: 'Seoul Moment',
          },
        },
      );

      // When: Request with Accept-Language header
      const response = await request(app.getHttpServer())
        .get(`/brand/${brand.id}`)
        .set('Accept-Language', 'en')
        .expect(200);

      // Then: Should return English content
      expect(response.body.data.name).toBe('Seoul Moment');
    });

    it('should handle various Accept-Language header formats', async () => {
      // Given: Create multilingual brand
      const { brand } = await testDataFactory.createMultilingualBrand(
        { status: BrandStatus.NORMAL },
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
        { header: 'en', expected: 'Seoul Moment' },
        { header: 'zh', expected: '首尔时刻' },
      ];

      for (const testCase of testCases) {
        const response = await request(app.getHttpServer())
          .get(`/brand/${brand.id}`)
          .set('Accept-Language', testCase.header)
          .expect(200);

        expect(response.body.data.name).toBe(testCase.expected);
      }
    });

    it('should return 404 for non-existent brand', async () => {
      // When: Request non-existent brand
      const response = await request(app.getHttpServer())
        .get('/brand/999?lang=ko')
        .expect(404);

      // Then: Should return error
      expect(response.body).toHaveProperty('code');
      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 for blocked brand', async () => {
      // Given: Create blocked brand
      const { brand } = await testDataFactory.createMultilingualBrand(
        { status: BrandStatus.BLOCK },
        {
          name: { [LanguageCode.KOREAN]: '차단된 브랜드' },
        },
      );

      // When: Request blocked brand
      const response = await request(app.getHttpServer())
        .get(`/brand/${brand.id}?lang=ko`)
        .expect(404);

      // Then: Should return error
      expect(response.body).toHaveProperty('code');
    });

    it('should return 400 for invalid brand ID', async () => {
      // When: Request with invalid ID
      const response = await request(app.getHttpServer())
        .get('/brand/invalid-id?lang=ko')
        .expect(400);

      // Then: Should return validation error
      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle empty multilingual content gracefully', async () => {
      // Given: Create brand without multilingual content
      const brand = await testDataFactory.createBrand({
        status: BrandStatus.NORMAL,
      });

      // When: Request brand
      const response = await request(app.getHttpServer())
        .get(`/brand/${brand.id}?lang=en`)
        .expect(200);

      // Then: Should return empty strings
      expect(response.body.data.name).toBe('');
      expect(response.body.data.description).toBe('');
      expect(response.body.data.section).toEqual([]);
      expect(response.body.data.bannerList).toEqual([]);
    });
  });
});

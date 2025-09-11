import { HttpExceptionFilter } from '@app/common/exception/http-exception-filter';
import { ServiceErrorFilter } from '@app/common/exception/service-exception-filter';
import { LoggerService } from '@app/common/log/logger.service';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  INestApplication,
  ValidationPipe,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { PartnerModule } from '../../apps/api/src/module/partner/partner.module';
import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('PartnerController (E2E)', () => {
  let app: INestApplication;
  let testDataFactory: TestDataFactory;

  beforeAll(async () => {
    await TestSetup.initialize();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PartnerModule, TestDatabaseModule],
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
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    await TestSetup.clearDatabase();
  });

  describe('GET /partner', () => {
    it('should return partners with Korean text when Accept-Language is ko', async () => {
      // Given
      const { partner, partnerCategory } =
        await testDataFactory.createMultilingualPartner(
          { country: LanguageCode.KOREAN },
          {
            title: {
              [LanguageCode.KOREAN]: '한국 협력사',
              [LanguageCode.ENGLISH]: 'Korean Partner',
              [LanguageCode.CHINESE]: '韩国合作伙伴',
            },
            description: {
              [LanguageCode.KOREAN]: '한국 협력사 설명',
              [LanguageCode.ENGLISH]: 'Korean Partner Description',
              [LanguageCode.CHINESE]: '韩国合作伙伴描述',
            },
          },
        );

      // When
      const response = await request(app.getHttpServer())
        .get('/partner')
        .set('Accept-Language', 'ko')
        .query({
          partnerCategoryId: partnerCategory.id,
          country: LanguageCode.KOREAN,
        })
        .expect(200);

      // Then
      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('list');
      expect(response.body.data).toHaveProperty('total', 1);
      expect(response.body.data.list).toHaveLength(1);
      expect(response.body.data.list[0]).toMatchObject({
        id: partner.id,
        title: '한국 협력사',
        description: '한국 협력사 설명',
        country: LanguageCode.KOREAN,
        image: expect.stringContaining(partner.image),
        link: partner.link,
      });
    });

    it('should return partners with English text when Accept-Language is en', async () => {
      // Given
      const { partner, partnerCategory } =
        await testDataFactory.createMultilingualPartner(
          { country: LanguageCode.KOREAN },
          {
            title: {
              [LanguageCode.KOREAN]: '한국 협력사',
              [LanguageCode.ENGLISH]: 'Korean Partner',
              [LanguageCode.CHINESE]: '韩国合作伙伴',
            },
            description: {
              [LanguageCode.KOREAN]: '한국 협력사 설명',
              [LanguageCode.ENGLISH]: 'Korean Partner Description',
              [LanguageCode.CHINESE]: '韩国合作伙伴描述',
            },
          },
        );

      // When
      const response = await request(app.getHttpServer())
        .get('/partner')
        .set('Accept-Language', 'en')
        .query({
          partnerCategoryId: partnerCategory.id,
          country: LanguageCode.KOREAN,
        })
        .expect(200);

      // Then
      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('list');
      expect(response.body.data).toHaveProperty('total', 1);
      expect(response.body.data.list).toHaveLength(1);
      expect(response.body.data.list[0]).toMatchObject({
        id: partner.id,
        title: 'Korean Partner',
        description: 'Korean Partner Description',
        country: LanguageCode.KOREAN,
        image: expect.stringContaining(partner.image),
        link: partner.link,
      });
    });

    it('should return partners with Chinese text when Accept-Language is zh', async () => {
      // Given
      const { partner, partnerCategory } =
        await testDataFactory.createMultilingualPartner(
          { country: LanguageCode.KOREAN },
          {
            title: {
              [LanguageCode.KOREAN]: '한국 협력사',
              [LanguageCode.ENGLISH]: 'Korean Partner',
              [LanguageCode.CHINESE]: '韩国合作伙伴',
            },
            description: {
              [LanguageCode.KOREAN]: '한국 협력사 설명',
              [LanguageCode.ENGLISH]: 'Korean Partner Description',
              [LanguageCode.CHINESE]: '韩国合作伙伴描述',
            },
          },
        );

      // When
      const response = await request(app.getHttpServer())
        .get('/partner')
        .set('Accept-Language', 'zh')
        .query({
          partnerCategoryId: partnerCategory.id,
          country: LanguageCode.KOREAN,
        })
        .expect(200);

      // Then
      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('list');
      expect(response.body.data).toHaveProperty('total', 1);
      expect(response.body.data.list).toHaveLength(1);
      expect(response.body.data.list[0]).toMatchObject({
        id: partner.id,
        title: '韩国合作伙伴',
        description: '韩国合作伙伴描述',
        country: LanguageCode.KOREAN,
        image: expect.stringContaining(partner.image),
        link: partner.link,
      });
    });

    it('should return multiple partners for the same category and country', async () => {
      // Given
      const partnerCategory = await testDataFactory.createPartnerCategory();

      const { partner: partner1 } =
        await testDataFactory.createMultilingualPartner(
          {
            partnerCategoryId: partnerCategory.id,
            country: LanguageCode.KOREAN,
          },
          {
            title: {
              [LanguageCode.KOREAN]: '첫 번째 협력사',
            },
          },
        );

      const { partner: partner2 } =
        await testDataFactory.createMultilingualPartner(
          {
            partnerCategoryId: partnerCategory.id,
            country: LanguageCode.KOREAN,
          },
          {
            title: {
              [LanguageCode.KOREAN]: '두 번째 협력사',
            },
          },
        );

      // When
      const response = await request(app.getHttpServer())
        .get('/partner')
        .set('Accept-Language', 'ko')
        .query({
          partnerCategoryId: partnerCategory.id,
          country: LanguageCode.KOREAN,
        })
        .expect(200);

      // Then
      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('list');
      expect(response.body.data).toHaveProperty('total', 2);
      expect(response.body.data.list).toHaveLength(2);
      expect(response.body.data.list).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: partner1.id,
            title: '첫 번째 협력사',
          }),
          expect.objectContaining({
            id: partner2.id,
            title: '두 번째 협력사',
          }),
        ]),
      );
    });

    it('should return empty array when no partners match criteria', async () => {
      // Given
      const partnerCategory = await testDataFactory.createPartnerCategory();
      await testDataFactory.createMultilingualPartner({
        partnerCategoryId: partnerCategory.id,
        country: LanguageCode.KOREAN,
      });

      // When
      const response = await request(app.getHttpServer())
        .get('/partner')
        .set('Accept-Language', 'ko')
        .query({
          partnerCategoryId: partnerCategory.id,
          country: LanguageCode.ENGLISH, // Different country
        })
        .expect(200);

      // Then
      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('list');
      expect(response.body.data).toHaveProperty('total', 0);
      expect(response.body.data.list).toHaveLength(0);
    });

    it('should validate required query parameters', async () => {
      // When & Then
      await request(app.getHttpServer())
        .get('/partner')
        .set('Accept-Language', 'ko')
        .expect(400);
    });

    it('should validate partnerCategoryId is number', async () => {
      // When & Then
      await request(app.getHttpServer())
        .get('/partner')
        .set('Accept-Language', 'ko')
        .query({
          partnerCategoryId: 'invalid',
          country: LanguageCode.KOREAN,
        })
        .expect(400);
    });

    it('should validate country is valid LanguageCode', async () => {
      // When & Then
      await request(app.getHttpServer())
        .get('/partner')
        .set('Accept-Language', 'ko')
        .query({
          partnerCategoryId: 1,
          country: 'invalid',
        })
        .expect(400);
    });

  });
});

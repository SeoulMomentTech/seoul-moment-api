import { HttpExceptionFilter } from '@app/common/exception/http-exception-filter';
import { ServiceErrorFilter } from '@app/common/exception/service-exception-filter';
import { LoggerService } from '@app/common/log/logger.service';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  BadRequestException,
  HttpStatus,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { LanguageModule } from '../../apps/api/src/module/language/language.module';
import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('LanguageController (E2E)', () => {
  let app: INestApplication;
  let testDataFactory: TestDataFactory;

  beforeAll(async () => {
    await TestSetup.initialize();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestDatabaseModule, LanguageModule],
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
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    await TestSetup.clearDatabase();
  });

  describe('GET /language', () => {
    it('빈 언어 목록을 반환해야 합니다', async () => {
      const response = await request(app.getHttpServer())
        .get('/language')
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('list', []);
      expect(response.body.data).toHaveProperty('total', 0);
    });

    it('활성 언어 목록을 반환해야 합니다', async () => {
      // Given
      const languages = await testDataFactory.createDefaultLanguages();

      // When
      const response = await request(app.getHttpServer())
        .get('/language')
        .expect(200);

      // Then
      expect(response.body).toHaveProperty('result', true);
      expect(response.body.data.list).toHaveLength(3);

      const languageList = response.body.data.list;
      expect(languageList).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: languages.korean.id,
            name: '한국어',
            code: 'ko',
            sortOrder: expect.any(Number),
          }),
          expect.objectContaining({
            id: languages.english.id,
            name: 'English',
            code: 'en',
            sortOrder: expect.any(Number),
          }),
          expect.objectContaining({
            id: languages.chinese.id,
            name: '中文',
            code: 'zh',
            sortOrder: expect.any(Number),
          }),
        ]),
      );
    });

    it('정렬 순서대로 언어 목록을 반환해야 합니다', async () => {
      // Given
      await testDataFactory.createLanguage({
        name: '첫 번째 언어',
        code: LanguageCode.KOREAN,
        sortOrder: 1,
      });

      await testDataFactory.createLanguage({
        name: '세 번째 언어',
        code: LanguageCode.ENGLISH,
        sortOrder: 3,
      });

      await testDataFactory.createLanguage({
        name: '두 번째 언어',
        code: LanguageCode.TAIWAN,
        sortOrder: 2,
      });

      // When
      const response = await request(app.getHttpServer())
        .get('/language')
        .expect(200);

      // Then
      const languageList = response.body.data.list;
      expect(languageList).toHaveLength(3);
      expect(languageList[0].name).toBe('첫 번째 언어');
      expect(languageList[1].name).toBe('두 번째 언어');
      expect(languageList[2].name).toBe('세 번째 언어');
    });

    it('비활성 언어는 목록에 포함하지 않아야 합니다', async () => {
      // Given
      await testDataFactory.createLanguage({
        name: '활성 언어',
        code: LanguageCode.KOREAN,
        sortOrder: 1,
        isActive: true,
      });

      await testDataFactory.createLanguage({
        name: '비활성 언어',
        code: LanguageCode.ENGLISH,
        sortOrder: 2,
        isActive: false,
      });

      // When
      const response = await request(app.getHttpServer())
        .get('/language')
        .expect(200);

      // Then
      expect(response.body.data.list).toHaveLength(1);
      expect(response.body.data.list[0].name).toBe('활성 언어');
    });

    it('응답 스키마가 올바른 형태여야 합니다', async () => {
      // Given
      const language = await testDataFactory.createLanguage({
        name: '테스트 언어',
        code: LanguageCode.KOREAN,
        sortOrder: 1,
      });

      // When
      const response = await request(app.getHttpServer())
        .get('/language')
        .expect(200);

      // Then
      const languageData = response.body.data.list[0];
      expect(languageData).toHaveProperty('id');
      expect(languageData).toHaveProperty('name');
      expect(languageData).toHaveProperty('code');
      expect(languageData).toHaveProperty('sortOrder');

      expect(typeof languageData.id).toBe('number');
      expect(typeof languageData.name).toBe('string');
      expect(typeof languageData.code).toBe('string');
      expect(typeof languageData.sortOrder).toBe('number');
    });
  });
});

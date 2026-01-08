import { HttpExceptionFilter } from '@app/common/exception/http-exception-filter';
import { ServiceErrorFilter } from '@app/common/exception/service-exception-filter';
import { LoggerService } from '@app/common/log/logger.service';
import {
  BadRequestException,
  HttpStatus,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { CategoryModule } from '../../apps/api/src/module/category/category.module';
import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('CategoryController (E2E)', () => {
  let app: INestApplication;
  let testDataFactory: TestDataFactory;

  beforeAll(async () => {
    await TestSetup.initialize();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestDatabaseModule, CategoryModule],
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

  describe('GET /category', () => {
    it('빈 카테고리 목록을 반환해야 합니다', async () => {
      const response = await request(app.getHttpServer())
        .get('/category')
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('list', []);
      expect(response.body.data).toHaveProperty('total', 0);
    });

    it('다국어 카테고리 목록을 조회해야 합니다', async () => {
      // Given
      const { category } = await testDataFactory.createMultilingualCategory(
        {},
        {
          name: {
            ko: '한국 카테고리',
            en: 'Korean Category',
            zh: '韩国类别',
          },
        },
      );

      // When
      const response = await request(app.getHttpServer())
        .get('/category')
        .set('Accept-Language', 'en')
        .expect(200);

      // Then
      expect(response.body).toHaveProperty('result', true);
      expect(response.body.data.list).toHaveLength(1);
      expect(response.body.data.list[0]).toMatchObject({
        id: category.id,
        name: 'Korean Category',
      });
    });
  });

  describe('POST /category', () => {
    it('다국어 카테고리를 생성해야 합니다', async () => {
      // Given
      const languages = await testDataFactory.createDefaultLanguages();
      const requestBody = {
        list: [
          {
            languageId: languages.korean.id,
            name: '테스트 카테고리',
          },
          {
            languageId: languages.english.id,
            name: 'Test Category',
          },
          {
            languageId: languages.chinese.id,
            name: '测试类别',
          },
        ],
      };

      // When
      const response = await request(app.getHttpServer())
        .post('/category')
        .send(requestBody)
        .expect(204);

      // Then
      expect(response.body).toEqual({});

      // 카테고리가 생성되었는지 확인
      const categoriesResponse = await request(app.getHttpServer())
        .get('/category')
        .set('Accept-Language', 'ko')
        .expect(200);

      expect(categoriesResponse.body.data.list).toHaveLength(1);
      expect(categoriesResponse.body.data.list[0]).toMatchObject({
        name: '테스트 카테고리',
      });
    });

    it('sort_order가 자동으로 증가해야 합니다', async () => {
      // Given
      const languages = await testDataFactory.createDefaultLanguages();

      // 첫 번째 카테고리 생성
      await request(app.getHttpServer())
        .post('/category')
        .send({
          list: [
            {
              languageId: languages.korean.id,
              name: '첫 번째 카테고리',
            },
          ],
        })
        .expect(204);

      // 두 번째 카테고리 생성
      await request(app.getHttpServer())
        .post('/category')
        .send({
          list: [
            {
              languageId: languages.korean.id,
              name: '두 번째 카테고리',
            },
          ],
        })
        .expect(204);

      // When
      const response = await request(app.getHttpServer())
        .get('/category')
        .set('Accept-Language', 'ko')
        .expect(200);

      // Then - sortOrder 필드는 DTO에 없으므로 이름으로 순서 확인
      expect(response.body.data.list).toHaveLength(2);
      expect(response.body.data.list[0].name).toBe('첫 번째 카테고리');
      expect(response.body.data.list[1].name).toBe('두 번째 카테고리');
    });

    it('잘못된 요청 시 400 에러를 반환해야 합니다', async () => {
      // Given
      const invalidRequestBody = {
        list: [
          {
            languageId: 'invalid',
            name: '',
          },
        ],
      };

      // When
      const response = await request(app.getHttpServer())
        .post('/category')
        .send(invalidRequestBody)
        .expect(400);

      // Then
      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('빈 배열로 요청 시 204 성공을 반환해야 합니다', async () => {
      // Given
      const emptyRequestBody = {
        list: [],
      };

      // When
      const response = await request(app.getHttpServer())
        .post('/category')
        .send(emptyRequestBody)
        .expect(204);

      // Then - 응답 본문이 비어있어야 함
      expect(response.body).toEqual({});

      // 카테고리가 생성되었는지 확인
      const categoriesResponse = await request(app.getHttpServer())
        .get('/category')
        .set('Accept-Language', 'ko')
        .expect(200);

      // 카테고리는 생성되지만 다국어 텍스트가 없어서 name이 null
      expect(categoriesResponse.body.data.list).toHaveLength(1);
      expect(categoriesResponse.body.data.list[0]).toMatchObject({
        id: expect.any(Number),
        name: null,
      });
    });
  });
});

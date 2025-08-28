import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { HttpExceptionFilter } from '@app/common/exception/http-exception-filter';
import { ServiceErrorFilter } from '@app/common/exception/service-exception-filter';
import { LoggerService } from '@app/common/log/logger.service';
import { Configuration } from '@app/config/configuration';
import { BrandStatus } from '@app/repository/enum/brand.enum';
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

describe('BrandController (E2E)', () => {
  let app: INestApplication;
  let testDataFactory: TestDataFactory;

  beforeAll(async () => {
    await TestSetup.initialize();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [BrandModule, TestDatabaseModule],
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

  describe('GET /brand/introduce/:id', () => {
    it('should return brand introduce data successfully', async () => {
      // Given: 실제 DB에 완전한 브랜드 데이터 생성
      const brand = await testDataFactory.createFullBrand({
        brand: {
          name: 'Seoul Moment',
          description: '서울의 특별한 순간들을 담은 브랜드',
          status: BrandStatus.NORMAL,
        },
        bannerCount: 2,
        sectionCount: 2,
        imagesPerSection: 3,
      });

      // When: HTTP GET 요청
      const response = await request(app.getHttpServer())
        .get(`/brand/introduce/${brand.id}`)
        .expect(200);

      // Then: 응답 데이터 검증
      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('data');

      const data = response.body.data;
      expect(data.id).toBe(brand.id);
      expect(data.name).toBe('Seoul Moment');
      expect(data.description).toBe('서울의 특별한 순간들을 담은 브랜드');
      expect(data.bannerList).toHaveLength(2);
      expect(data.section).toHaveLength(2);

      // 배너 리스트 검증
      data.bannerList.forEach((bannerUrl: string) => {
        expect(bannerUrl).toMatch(/^https:\/\/.*\.jpg$/);
      });

      // 섹션 데이터 검증
      data.section.forEach((section: any) => {
        expect(section).toHaveProperty('title');
        expect(section).toHaveProperty('content');
        expect(section).toHaveProperty('imageList');
        expect(section.imageList).toHaveLength(3);

        section.imageList.forEach((imageUrl: string) => {
          expect(imageUrl).toMatch(/^https:\/\/.*\.jpg$/);
        });
      });
    });

    it('should return 404 when brand does not exist', async () => {
      // When: 존재하지 않는 브랜드 ID로 요청
      const response = await request(app.getHttpServer())
        .get('/brand/introduce/999')
        .expect(404);

      // Then: 에러 응답 검증 (ServiceError 직접 응답)
      expect(response.body).toHaveProperty(
        'code',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
      expect(response.body).toHaveProperty(
        'message',
        'Brand not found or not in normal status',
      );
    });

    it('should return 404 when brand exists but not NORMAL status', async () => {
      // Given: BLOCK 상태의 브랜드 생성
      const blockedBrand = await testDataFactory.createBrand({
        name: 'Blocked Brand',
        status: BrandStatus.BLOCK,
      });

      // When: BLOCK 상태 브랜드 조회 요청
      const response = await request(app.getHttpServer())
        .get(`/brand/introduce/${blockedBrand.id}`)
        .expect(404);

      // Then: 에러 응답 검증 (ServiceError 직접 응답)
      expect(response.body).toHaveProperty(
        'code',
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    });

    it('should return brand with empty arrays when no banners or sections', async () => {
      // Given: 배너와 섹션이 없는 최소한의 브랜드 생성
      const minimalBrand = await testDataFactory.createBrand({
        name: 'Minimal Brand',
        description: 'Simple brand',
        status: BrandStatus.NORMAL,
      });

      // When: HTTP GET 요청
      const response = await request(app.getHttpServer())
        .get(`/brand/introduce/${minimalBrand.id}`)
        .expect(200);

      // Then: 빈 배열들이 정상적으로 반환됨
      expect(response.body.result).toBe(true);
      const data = response.body.data;
      expect(data.id).toBe(minimalBrand.id);
      expect(data.name).toBe('Minimal Brand');
      expect(data.description).toBe('Simple brand');
      expect(data.bannerList).toEqual([]);
      expect(data.section).toEqual([]);
    });

    it('should return correctly sorted data by sortOrder', async () => {
      // Given: 정렬 순서가 다른 브랜드 데이터 생성
      const brand = await testDataFactory.createBrand({
        name: 'Sorted Brand',
        status: BrandStatus.NORMAL,
      });

      // 배너를 역순으로 생성
      await testDataFactory.createBannerImage(brand, {
        sortOrder: 3,
        imageUrl: '/banner3.jpg',
        altText: 'Banner 3',
      });
      await testDataFactory.createBannerImage(brand, {
        sortOrder: 1,
        imageUrl: '/banner1.jpg',
        altText: 'Banner 1',
      });
      await testDataFactory.createBannerImage(brand, {
        sortOrder: 2,
        imageUrl: '/banner2.jpg',
        altText: 'Banner 2',
      });

      // 섹션을 역순으로 생성
      await testDataFactory.createBrandSection(brand, {
        title: 'Second Section',
        content: 'Content 2',
        sortOrder: 2,
      });
      const section1 = await testDataFactory.createBrandSection(brand, {
        title: 'First Section',
        content: 'Content 1',
        sortOrder: 1,
      });

      // 첫 번째 섹션에 이미지를 역순으로 생성
      await testDataFactory.createSectionImage(section1, {
        sortOrder: 2,
        imageUrl: '/section1-2.jpg',
        altText: 'Section 1 Image 2',
      });
      await testDataFactory.createSectionImage(section1, {
        sortOrder: 1,
        imageUrl: '/section1-1.jpg',
        altText: 'Section 1 Image 1',
      });

      // When: HTTP GET 요청
      const response = await request(app.getHttpServer())
        .get(`/brand/introduce/${brand.id}`)
        .expect(200);

      // Then: 정렬된 순서로 반환됨
      const data = response.body.data;

      expect(data.bannerList).toEqual([
        `${Configuration.getConfig().IMAGE_DOMAIN_NAME}/banner1.jpg`,
        `${Configuration.getConfig().IMAGE_DOMAIN_NAME}/banner2.jpg`,
        `${Configuration.getConfig().IMAGE_DOMAIN_NAME}/banner3.jpg`,
      ]);

      expect(data.section).toHaveLength(2);
      expect(data.section[0].title).toBe('First Section');
      expect(data.section[1].title).toBe('Second Section');

      expect(data.section[0].imageList).toEqual([
        `${Configuration.getConfig().IMAGE_DOMAIN_NAME}/section1-1.jpg`,
        `${Configuration.getConfig().IMAGE_DOMAIN_NAME}/section1-2.jpg`,
      ]);
    });

    it('should handle invalid brand ID parameter', async () => {
      // When: 잘못된 형식의 ID로 요청
      // Note: 현재는 500 에러가 발생하고 있으므로 실제 동작에 맞춤
      const response = await request(app.getHttpServer())
        .get('/brand/introduce/invalid-id')
        .expect(400);

      // Then: Internal Server Error 응답
      expect(response.body).toHaveProperty('message');
    });

    it('should handle concurrent requests correctly', async () => {
      // Given: 브랜드 데이터 생성
      const brand = await testDataFactory.createFullBrand({
        brand: {
          name: 'Concurrent Brand',
          status: BrandStatus.NORMAL,
        },
        bannerCount: 2,
        sectionCount: 1,
        imagesPerSection: 2,
      });

      // When: 동시에 여러 요청 보내기
      const requests = Array(5)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .get(`/brand/introduce/${brand.id}`)
            .expect(200),
        );

      const responses = await Promise.all(requests);

      // Then: 모든 요청이 같은 결과 반환
      responses.forEach((response) => {
        expect(response.body.result).toBe(true);
        expect(response.body.data.id).toBe(brand.id);
        expect(response.body.data.name).toBe('Concurrent Brand');
        expect(response.body.data.bannerList).toHaveLength(2);
        expect(response.body.data.section).toHaveLength(1);
      });

      // 모든 응답이 동일한지 확인
      const firstResponse = responses[0].body.data;
      responses.slice(1).forEach((response) => {
        expect(response.body.data).toEqual(firstResponse);
      });
    });

    it('should handle large brand data correctly', async () => {
      // Given: 큰 규모의 브랜드 데이터 생성
      const largeBrand = await testDataFactory.createBrand({
        name: 'Large Brand',
        description: 'A' + 'very '.repeat(100) + 'large brand description',
        status: BrandStatus.NORMAL,
      });

      // 많은 배너 생성
      for (let i = 1; i <= 10; i++) {
        await testDataFactory.createBannerImage(largeBrand, {
          sortOrder: i,
          imageUrl: `/banner${i}.jpg`,
          altText: `Banner ${i}`,
        });
      }

      // 많은 섹션과 각 섹션마다 많은 이미지 생성
      for (let sectionIndex = 1; sectionIndex <= 5; sectionIndex++) {
        const section = await testDataFactory.createBrandSection(largeBrand, {
          title: `Section ${sectionIndex}`,
          content:
            `Content for section ${sectionIndex}. ` +
            'Long content. '.repeat(50),
          sortOrder: sectionIndex,
        });

        for (let imgIndex = 1; imgIndex <= 8; imgIndex++) {
          await testDataFactory.createSectionImage(section, {
            sortOrder: imgIndex,
            imageUrl: `/section${sectionIndex}-${imgIndex}.jpg`,
            altText: `Section ${sectionIndex} Image ${imgIndex}`,
          });
        }
      }

      // When: HTTP GET 요청
      const response = await request(app.getHttpServer())
        .get(`/brand/introduce/${largeBrand.id}`)
        .expect(200);

      // Then: 모든 데이터가 정확히 반환됨
      const data = response.body.data;
      expect(data.bannerList).toHaveLength(10);
      expect(data.section).toHaveLength(5);

      data.section.forEach((section: any, index: number) => {
        expect(section.title).toBe(`Section ${index + 1}`);
        expect(section.imageList).toHaveLength(8);
      });
    });

    it('should maintain data consistency after multiple operations', async () => {
      // Given: 초기 브랜드 생성
      const brand = await testDataFactory.createFullBrand({
        brand: {
          name: 'Consistent Brand',
          status: BrandStatus.NORMAL,
        },
        bannerCount: 1,
        sectionCount: 1,
        imagesPerSection: 1,
      });

      // When: 첫 번째 요청
      const firstResponse = await request(app.getHttpServer())
        .get(`/brand/introduce/${brand.id}`)
        .expect(200);

      // 추가 데이터 생성
      await testDataFactory.createBannerImage(brand, {
        sortOrder: 2,
        imageUrl: '/new-banner.jpg',
        altText: 'New Banner',
      });

      // When: 두 번째 요청 (데이터 추가 후)
      const secondResponse = await request(app.getHttpServer())
        .get(`/brand/introduce/${brand.id}`)
        .expect(200);

      // Then: 데이터가 일관되게 업데이트됨
      expect(firstResponse.body.result).toBe(true);
      expect(secondResponse.body.result).toBe(true);
      expect(firstResponse.body.data.bannerList).toHaveLength(1);
      expect(secondResponse.body.data.bannerList).toHaveLength(2);

      expect(secondResponse.body.data.bannerList).toContain(
        `${Configuration.getConfig().IMAGE_DOMAIN_NAME}/new-banner.jpg`,
      );
    });
  });
});

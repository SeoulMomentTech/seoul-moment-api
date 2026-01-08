import { HttpExceptionFilter } from '@app/common/exception/http-exception-filter';
import { ServiceErrorFilter } from '@app/common/exception/service-exception-filter';
import { LoggerService } from '@app/common/log/logger.service';
import { BrandStatus } from '@app/repository/enum/brand.enum';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  OptionType,
  ProductItemStatus,
  ProductStatus,
} from '@app/repository/enum/product.enum';
import {
  BadRequestException,
  HttpStatus,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { ProductModule } from '../../apps/api/src/module/product/product.module';
import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('ProductController (E2E)', () => {
  let app: INestApplication;
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    module = await Test.createTestingModule({
      imports: [ProductModule, TestDatabaseModule],
    }).compile();

    app = module.createNestApplication();

    // LoggerService 인스턴스 가져오기
    const logger = module.get<LoggerService>(LoggerService);

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
    await module.close();
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    await TestSetup.clearDatabase();
    // 추가적으로 관련 테이블들 직접 정리
    const dataSource = TestSetup.getDataSource();
    await dataSource.query('TRUNCATE TABLE multilingual_text CASCADE;');
    await dataSource.query('TRUNCATE TABLE product_color_image CASCADE;');
    await dataSource.query('TRUNCATE TABLE product_image CASCADE;');
    await dataSource.query('TRUNCATE TABLE variant_option CASCADE;');
    await dataSource.query('TRUNCATE TABLE product_variant CASCADE;');
    await dataSource.query('TRUNCATE TABLE product_color CASCADE;');
    await dataSource.query('TRUNCATE TABLE product CASCADE;');
    await dataSource.query('TRUNCATE TABLE brand CASCADE;');
    await dataSource.query('TRUNCATE TABLE category CASCADE;');
    await dataSource.query('TRUNCATE TABLE product_category CASCADE;');
    await dataSource.query('TRUNCATE TABLE product_banner CASCADE;');
    await dataSource.query('TRUNCATE TABLE "option" CASCADE;');
    await dataSource.query('TRUNCATE TABLE option_value CASCADE;');
    await dataSource.query('TRUNCATE TABLE language CASCADE;');
  });

  describe('/product/banner (GET)', () => {
    it('빈 배너 목록을 반환해야 함', async () => {
      const response = await request(app.getHttpServer())
        .get('/product/banner')
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('list', []);
      expect(response.body.data).toHaveProperty('total', 0);
    });

    it('생성된 배너들을 반환해야 함', async () => {
      // Given: 배너들 생성
      await testDataFactory.createProductBanner({
        image: '/banner1.jpg',
        sortOrder: 1,
      });
      await testDataFactory.createProductBanner({
        image: '/banner2.jpg',
        sortOrder: 2,
      });

      // When & Then
      const response = await request(app.getHttpServer())
        .get('/product/banner')
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body.data.list).toHaveLength(2);
      expect(response.body.data).toHaveProperty('total', 2);
      expect(response.body.data.list[0]).toHaveProperty('banner');
    });
  });

  describe('/product/category (GET)', () => {
    it('Accept-Language 헤더 없이 요청 시 정상 동작해야 함', async () => {
      await request(app.getHttpServer())
        .get('/product/category?categoryId=1')
        .expect(200);
    });

    it('다국어 지원 카테고리 목록을 반환해야 함', async () => {
      // Given: 언어와 카테고리 생성
      const language = await testDataFactory.createLanguage({
        code: LanguageCode.ENGLISH,
      });

      const category = await testDataFactory.createCategory();

      const productCategory = await testDataFactory.createProductCategory({
        category,
        sortOrder: 1,
      });

      // 다국어 텍스트 추가
      await testDataFactory.createMultilingualText(
        EntityType.PRODUCT_CATEGORY,
        productCategory.id,
        'name',
        language,
        'Top Category',
      );

      // When & Then
      const response = await request(app.getHttpServer())
        .get('/product/category?categoryId=1')
        .set('Accept-Language', 'en')
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body.data.list).toHaveLength(1);
      expect(response.body.data.list[0]).toHaveProperty(
        'id',
        productCategory.id,
      );
      expect(response.body.data.list[0]).toHaveProperty('name', 'Top Category');
    });
  });

  describe('/product (GET)', () => {
    it('Accept-Language 헤더 없이 요청 시 정상 동작해야 함', async () => {
      await request(app.getHttpServer())
        .get('/product?page=1&count=10')
        .expect(200);
    });

    it('필수 쿼리 파라미터 없이 요청 시 에러가 발생해야 함', async () => {
      await request(app.getHttpServer())
        .get('/product')
        .set('Accept-Language', 'en')
        .expect(400);
    });

    it('다국어 지원 상품 목록을 반환해야 함', async () => {
      // Given: 언어, 브랜드, 상품 생성
      const language = await testDataFactory.createLanguage({
        code: LanguageCode.ENGLISH,
      });
      const brand = await testDataFactory.createBrand({
        status: BrandStatus.NORMAL,
      });
      const category = await testDataFactory.createCategory();
      const product = await testDataFactory.createProduct(brand, {
        status: ProductStatus.NORMAL,
        categoryId: category.id,
      });

      // 브랜드와 상품에 영어 다국어 텍스트 추가
      await testDataFactory.createMultilingualText(
        EntityType.BRAND,
        brand.id,
        'name',
        language,
        'Test Brand EN',
      );
      await testDataFactory.createMultilingualText(
        EntityType.PRODUCT,
        product.id,
        'name',
        language,
        'Test Product EN',
      );

      // 상품 색상 생성
      const option = await testDataFactory.createOption();
      const optionValue = await testDataFactory.createOptionValue(option);
      await testDataFactory.createProductItem(product, optionValue, {
        status: ProductItemStatus.NORMAL,
        price: 10000,
      });

      // When & Then
      const response = await request(app.getHttpServer())
        .get('/product?page=1&count=10')
        .set('Accept-Language', 'en')
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body.data.list).toHaveLength(1);
      expect(response.body.data).toHaveProperty('total', 1);
      expect(response.body.data.list[0]).toHaveProperty(
        'brandName',
        'Test Brand EN',
      );
      expect(response.body.data.list[0]).toHaveProperty(
        'productName',
        'Test Product EN',
      );
      expect(response.body.data.list[0]).toHaveProperty('price', 10000);
      expect(response.body.data.list[0]).toHaveProperty('like');
      expect(response.body.data.list[0]).toHaveProperty('review');
      expect(response.body.data.list[0]).toHaveProperty('reviewAverage');
      expect(response.body.data.list[0]).toHaveProperty('image');
    });
  });

  describe('/product/:id (GET)', () => {
    it('Accept-Language 헤더 없이 요청 시 404 에러가 발생해야 함', async () => {
      await request(app.getHttpServer()).get('/product/1').expect(404);
    });

    it('존재하지 않는 상품 ID로 요청 시 404 에러가 발생해야 함', async () => {
      await request(app.getHttpServer())
        .get('/product/999999')
        .set('Accept-Language', 'en')
        .expect(404);
    });

    it('상품 상세 정보를 반환해야 함', async () => {
      // Given: 복합적인 상품 데이터 생성
      const language = await testDataFactory.createLanguage({
        code: LanguageCode.ENGLISH,
      });
      const brand = await testDataFactory.createBrand({
        status: BrandStatus.NORMAL,
        profileImage: '/brand-profile.jpg',
      });
      const category = await testDataFactory.createCategory();
      const product = await testDataFactory.createProduct(brand, {
        status: ProductStatus.NORMAL,
        categoryId: category.id,
        detailInfoImageUrl: '/product-detail.jpg',
      });

      // 브랜드와 상품 다국어 텍스트
      await testDataFactory.createMultilingualText(
        EntityType.BRAND,
        brand.id,
        'name',
        language,
        'Test Brand EN',
      );
      await testDataFactory.createMultilingualText(
        EntityType.PRODUCT,
        product.id,
        'name',
        language,
        'Test Product EN',
      );
      await testDataFactory.createMultilingualText(
        EntityType.PRODUCT,
        product.id,
        'origin',
        language,
        'Made in Korea',
      );

      // 옵션들 생성
      const colorOption = await testDataFactory.createOption({
        type: OptionType.COLOR,
      });
      const sizeOption = await testDataFactory.createOption({
        type: OptionType.SIZE,
      });

      const redValue = await testDataFactory.createOptionValue(colorOption, {
        sortOrder: 1,
      });
      const sizeValue = await testDataFactory.createOptionValue(sizeOption, {
        sortOrder: 1,
      });

      // 옵션값 다국어 텍스트
      await testDataFactory.createMultilingualText(
        EntityType.OPTION_VALUE,
        redValue.id,
        'value',
        language,
        'Red',
      );
      await testDataFactory.createMultilingualText(
        EntityType.OPTION_VALUE,
        sizeValue.id,
        'value',
        language,
        'Large',
      );

      // 상품 색상 생성
      const productItem = await testDataFactory.createProductItem(
        product,
        redValue,
        {
          status: ProductItemStatus.NORMAL,
          price: 20000,
          discountPrice: 15000,
          shippingInfo: 3,
          shippingCost: 3000,
        },
      );

      // 상품 색상 이미지 생성
      await testDataFactory.createProductItemImage(productItem, {
        imageUrl: '/product-image1.jpg',
        sortOrder: 1,
      });
      await testDataFactory.createProductItemImage(productItem, {
        imageUrl: '/product-image2.jpg',
        sortOrder: 2,
      });

      // 상품 variant 생성
      const variant = await testDataFactory.createProductVariant(product, {
        sku: `TEST-SKU-E2E-${Date.now()}`,
      });

      // variant-option 연결
      await testDataFactory.createVariantOption(variant, redValue);
      await testDataFactory.createVariantOption(variant, sizeValue);

      // When & Then
      const response = await request(app.getHttpServer())
        .get(`/product/${productItem.id}`)
        .set('Accept-Language', 'en')
        .expect(200);

      expect(response.body).toHaveProperty('result', true);
      expect(response.body.data).toHaveProperty('id', productItem.id);
      expect(response.body.data).toHaveProperty('name', 'Test Product EN');
      expect(response.body.data.brand).toHaveProperty('name', 'Test Brand EN');
      expect(response.body.data.brand).toHaveProperty(
        'profileImg',
        'https://image-dev.seoulmoment.com.tw/brand-profile.jpg',
      );
      expect(response.body.data).toHaveProperty('price', 20000);
      expect(response.body.data).toHaveProperty('discoountPrice', 15000);
      expect(response.body.data).toHaveProperty('origin', 'Made in Korea');
      expect(response.body.data).toHaveProperty('shippingInfo', 3);
      expect(response.body.data).toHaveProperty('shippingCost', 3000);
      expect(response.body.data).toHaveProperty(
        'detailImg',
        'https://image-dev.seoulmoment.com.tw/product-detail.jpg',
      );
      expect(response.body.data).toHaveProperty('subImage');
      expect(response.body.data.subImage).toHaveLength(2);
      expect(response.body.data).toHaveProperty('option');
      expect(response.body.data.option).toHaveLength(2);
      expect(response.body.data).toHaveProperty('like');
      expect(response.body.data).toHaveProperty('review');
      expect(response.body.data).toHaveProperty('reviewAverage');

      // 옵션 확인
      const colorOptionResult = response.body.data.option.find(
        (opt: any) => opt[OptionType.COLOR],
      );
      const sizeOptionResult = response.body.data.option.find(
        (opt: any) => opt[OptionType.SIZE],
      );

      expect(colorOptionResult).toBeDefined();
      expect(colorOptionResult[OptionType.COLOR]).toHaveLength(1);
      expect(colorOptionResult[OptionType.COLOR][0]).toHaveProperty(
        'value',
        'Red',
      );

      expect(sizeOptionResult).toBeDefined();
      expect(sizeOptionResult[OptionType.SIZE]).toHaveLength(1);
      expect(sizeOptionResult[OptionType.SIZE][0]).toHaveProperty(
        'value',
        'Large',
      );
    });

    it('차단된 상품 색상 조회 시 404 에러가 발생해야 함', async () => {
      // Given: 차단된 상품 색상 생성
      const brand = await testDataFactory.createBrand({
        status: BrandStatus.NORMAL,
      });
      const category = await testDataFactory.createCategory();
      const product = await testDataFactory.createProduct(brand, {
        status: ProductStatus.NORMAL,
        categoryId: category.id,
      });
      const option = await testDataFactory.createOption();
      const optionValue = await testDataFactory.createOptionValue(option);
      const productItem = await testDataFactory.createProductItem(
        product,
        optionValue,
        {
          status: ProductItemStatus.BLOCK,
          price: 10000,
        },
      );

      // When & Then: 차단된 상품 색상 조회 시 404 에러 발생
      await request(app.getHttpServer())
        .get(`/product/${productItem.id}`)
        .set('Accept-Language', 'en')
        .expect(404);
    });

    it('유효하지 않은 ID 형식으로 요청 시 400 에러가 발생해야 함', async () => {
      await request(app.getHttpServer())
        .get('/product/invalid-id')
        .set('Accept-Language', 'en')
        .expect(400);
    });
  });
});

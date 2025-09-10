import { ServiceError } from '@app/common/exception/service.error';
import { BrandStatus } from '@app/repository/enum/brand.enum';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  OptionType,
  ProductColorStatus,
  ProductStatus,
} from '@app/repository/enum/product.enum';
import { Test, TestingModule } from '@nestjs/testing';

import { GetProductRequest } from '../../apps/api/src/module/product/product.dto';
import { ProductModule } from '../../apps/api/src/module/product/product.module';
import { ProductService } from '../../apps/api/src/module/product/product.service';
import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('ProductService Integration Tests', () => {
  let productService: ProductService;
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    module = await Test.createTestingModule({
      imports: [TestDatabaseModule, ProductModule],
    }).compile();

    productService = module.get<ProductService>(ProductService);
    testDataFactory = new TestDataFactory(TestSetup.getDataSource());
  });

  afterAll(async () => {
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

  describe('getProductBanner', () => {
    it('빈 배너 목록을 반환해야 함', async () => {
      const banners = await productService.getProductBanner();
      expect(banners).toEqual([]);
    });

    it('생성된 배너들을 반환해야 함', async () => {
      // Given: 배너들 생성
      const banner1 = await testDataFactory.createProductBanner({
        image: '/banner1.jpg',
        sortOrder: 1,
      });
      const banner2 = await testDataFactory.createProductBanner({
        image: '/banner2.jpg',
        sortOrder: 2,
      });

      // When: 배너 목록 조회
      const banners = await productService.getProductBanner();

      // Then: 변환된 배너가 반환되어야 함
      expect(banners).toHaveLength(2);
      expect(banners.map((b) => b.banner)).toContain(
        'https://image-dev.seoulmoment.com.tw/banner1.jpg',
      );
      expect(banners.map((b) => b.banner)).toContain(
        'https://image-dev.seoulmoment.com.tw/banner2.jpg',
      );
    });
  });

  describe('getProductCategory', () => {
    it('다국어 지원 카테고리 목록을 반환해야 함', async () => {
      // Given: 언어와 카테고리 생성
      const language = await testDataFactory.createLanguage({
        code: LanguageCode.ENGLISH,
      });
      const category = await testDataFactory.createProductCategory({
        sortOrder: 1,
      });

      // 다국어 텍스트 추가
      await testDataFactory.createMultilingualText(
        EntityType.PRODUCT_CATEGORY,
        category.id,
        'name',
        language,
        'Top Category',
      );

      // When: 영어로 카테고리 목록 조회
      const categories = await productService.getProductCategory(
        LanguageCode.ENGLISH,
      );

      // Then: 영어로 변환된 카테고리가 반환되어야 함
      expect(categories).toHaveLength(1);
      expect(categories[0].id).toBe(category.id);
      expect(categories[0].name).toBe('Top Category');
    });
  });

  describe('getProduct', () => {
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
      const productColor = await testDataFactory.createProductColor(
        product,
        optionValue,
        {
          status: ProductColorStatus.NORMAL,
          price: 10000,
        },
      );

      // When: 영어로 상품 목록 조회
      const request = GetProductRequest.from(
        1, // page
        10, // count
        undefined, // sortColum
        undefined, // sort
        undefined, // search
        undefined, // brandId
        undefined, // categoryId
        undefined, // productCategoryId
      );

      const [products, count] = await productService.getProduct(
        request,
        LanguageCode.ENGLISH,
      );

      // Then: 영어로 변환된 상품이 반환되어야 함
      expect(products).toHaveLength(1);
      expect(count).toBe(1);
      expect(products[0].brandName).toBe('Test Brand EN');
      expect(products[0].productName).toBe('Test Product EN');
      expect(products[0].price).toBe(10000);
    });
  });

  describe('getProductDetail', () => {
    it('상품 상세 정보를 반환해야 함', async () => {
      // Given: 복합적인 상품 데이터 생성
      const language = await testDataFactory.createLanguage({
        code: LanguageCode.KOREAN,
        name: 'Korean Language For Detail Test',
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
      const productColor = await testDataFactory.createProductColor(
        product,
        redValue,
        {
          status: ProductColorStatus.NORMAL,
          price: 20000,
          discountPrice: 15000,
          shippingInfo: 3,
          shippingCost: 3000,
        },
      );

      // 상품 색상 이미지 생성
      await testDataFactory.createProductColorImage(productColor, {
        imageUrl: '/product-image1.jpg',
        sortOrder: 1,
      });
      await testDataFactory.createProductColorImage(productColor, {
        imageUrl: '/product-image2.jpg',
        sortOrder: 2,
      });

      // 상품 variant 생성
      const variant = await testDataFactory.createProductVariant(product, {
        sku: 'TEST-SKU-001',
      });

      // variant-option 연결
      await testDataFactory.createVariantOption(variant, redValue);
      await testDataFactory.createVariantOption(variant, sizeValue);

      // When: 상품 상세 정보 조회
      const productDetail = await productService.getProductDetail(
        productColor.id,
        LanguageCode.KOREAN,
      );

      // Then: 완전한 상품 상세 정보가 반환되어야 함
      expect(productDetail).toBeDefined();
      expect(productDetail.id).toBe(productColor.id);
      expect(productDetail.name).toBe('Test Product EN');
      expect(productDetail.brand.name).toBe('Test Brand EN');
      expect(productDetail.brand.profileImg).toBe(
        'https://image-dev.seoulmoment.com.tw/brand-profile.jpg',
      );
      expect(productDetail.price).toBe(20000);
      expect(productDetail.discoountPrice).toBe(15000);
      expect(productDetail.origin).toBe('Made in Korea');
      expect(productDetail.shippingInfo).toBe(3);
      expect(productDetail.shippingCost).toBe(3000);
      expect(productDetail.detailImg).toBe(
        'https://image-dev.seoulmoment.com.tw/product-detail.jpg',
      );
      expect(productDetail.subImage).toHaveLength(2);
      expect(productDetail.option).toHaveLength(2);

      // 옵션 확인
      const colorOptionResult = productDetail.option.find(
        (opt) => opt[OptionType.COLOR],
      );
      const sizeOptionResult = productDetail.option.find(
        (opt) => opt[OptionType.SIZE],
      );

      expect(colorOptionResult).toBeDefined();
      expect(colorOptionResult[OptionType.COLOR]).toHaveLength(1);
      expect(colorOptionResult[OptionType.COLOR][0].value).toBe('Red');

      expect(sizeOptionResult).toBeDefined();
      expect(sizeOptionResult[OptionType.SIZE]).toHaveLength(1);
      expect(sizeOptionResult[OptionType.SIZE][0].value).toBe('Large');

      // 랜덤 값들 확인 (범위 체크)
      expect(productDetail.like).toBeGreaterThanOrEqual(0);
      expect(productDetail.like).toBeLessThanOrEqual(50000);
      expect(productDetail.review).toBeGreaterThanOrEqual(0);
      expect(productDetail.review).toBeLessThanOrEqual(10000);
      expect(productDetail.reviewAverage).toBeGreaterThanOrEqual(0);
      expect(productDetail.reviewAverage).toBeLessThanOrEqual(5);
    });

    it('존재하지 않는 상품 색상 조회 시 에러가 발생해야 함', async () => {
      // When & Then: 존재하지 않는 ID로 조회 시 에러 발생
      await expect(
        productService.getProductDetail(999999, LanguageCode.KOREAN),
      ).rejects.toThrow(ServiceError);
    });

    it('차단된 상품 색상 조회 시 에러가 발생해야 함', async () => {
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
      const productColor = await testDataFactory.createProductColor(
        product,
        optionValue,
        {
          status: ProductColorStatus.BLOCK,
          price: 10000,
        },
      );

      // When & Then: 차단된 상품 색상 조회 시 에러 발생
      await expect(
        productService.getProductDetail(productColor.id, LanguageCode.KOREAN),
      ).rejects.toThrow(ServiceError);
    });
  });
});

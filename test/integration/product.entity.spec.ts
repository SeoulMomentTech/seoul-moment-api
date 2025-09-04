import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { ProductEntity } from '@app/repository/entity/product.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import {
  OptionType,
  ProductImageType,
  ProductStatus,
} from '@app/repository/enum/product.enum';
import { Test, TestingModule } from '@nestjs/testing';

import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('Product Entities Integration Tests', () => {
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    module = await Test.createTestingModule({
      imports: [TestDatabaseModule],
    }).compile();

    testDataFactory = new TestDataFactory(TestSetup.getDataSource());
  });

  afterAll(async () => {
    await module.close();
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    await TestSetup.clearDatabase();
  });

  describe('Basic Entity Creation', () => {
    it('should create Product with Brand relationship', async () => {
      // Given: 브랜드 생성
      const brand = await testDataFactory.createBrand();

      // When: 상품 생성
      const product = await testDataFactory.createProduct(brand, {
        detailInfoImageUrl: 'https://example.com/detail.jpg',
      });

      // Then: 상품이 정상 생성되고 브랜드와 연결되어야 함
      expect(product.id).toBeDefined();
      expect(product.brandId).toBe(brand.id);
      expect(product.status).toBe(ProductStatus.NORMAL);
      expect(product.detailInfoImageUrl).toBe('https://example.com/detail.jpg');
      expect(product.getDetailInfoImage()).toContain('detail.jpg');
    });

    it('should create ProductImage with correct relationships', async () => {
      // Given: 브랜드와 상품 생성
      const brand = await testDataFactory.createBrand();
      const product = await testDataFactory.createProduct(brand);

      // When: 상품 이미지 생성
      const image = await testDataFactory.createProductImage(product, {
        imageType: ProductImageType.MAIN,
        imageUrl: 'https://example.com/gallery.jpg',
        altText: 'Main product image',
        sortOrder: 1,
      });

      // Then: 이미지가 정상 생성되고 상품과 연결되어야 함
      expect(image.id).toBeDefined();
      expect(image.productId).toBe(product.id);
      expect(image.imageType).toBe(ProductImageType.MAIN);
      expect(image.altText).toBe('Main product image');
      expect(image.getImage()).toContain('gallery.jpg');
    });

    it('should create Option and OptionValue with relationships', async () => {
      // Given: 옵션 생성
      const option = await testDataFactory.createOption({
        type: OptionType.COLOR,
      });

      // When: 옵션값 생성
      const optionValue = await testDataFactory.createOptionValue(option, {
        colorCode: '#FF0000',
      });

      // Then: 옵션과 옵션값이 정상 생성되고 연결되어야 함
      expect(option.id).toBeDefined();
      expect(option.type).toBe(OptionType.COLOR);

      expect(optionValue.id).toBeDefined();
      expect(optionValue.optionId).toBe(option.id);
      expect(optionValue.colorCode).toBe('#FF0000');
    });

    it('should create ProductVariant with VariantOption relationships', async () => {
      // Given: 브랜드, 상품, 옵션, 옵션값 생성
      const brand = await testDataFactory.createBrand();
      const product = await testDataFactory.createProduct(brand);
      const colorOption = await testDataFactory.createOption({
        type: OptionType.COLOR,
      });
      const redValue = await testDataFactory.createOptionValue(colorOption);

      // When: 상품 변형 생성 및 옵션값 연결
      const variant = await testDataFactory.createProductVariant(product, {
        sku: 'TEST-RED-M',
        stockQuantity: 10,
      });

      const variantOption = await testDataFactory.createVariantOption(
        variant,
        redValue,
      );

      // Then: 변형이 정상 생성되고 옵션값과 연결되어야 함
      expect(variant.id).toBeDefined();
      expect(variant.productId).toBe(product.id);
      expect(variant.sku).toBe('TEST-RED-M');
      expect(variant.isInStock()).toBe(true);

      expect(variantOption.variantId).toBe(variant.id);
      expect(variantOption.optionValueId).toBe(redValue.id);
    });

    it('should create Product with ProductColor relationships', async () => {
      // Given: 브랜드, 상품, 색상 옵션 생성
      const brand = await testDataFactory.createBrand();
      const product = await testDataFactory.createProduct(brand);

      const colorOption = await testDataFactory.createOption({
        type: OptionType.COLOR,
      });

      const redValue = await testDataFactory.createOptionValue(colorOption, {
        colorCode: '#FF0000',
      });

      const blueValue = await testDataFactory.createOptionValue(colorOption, {
        colorCode: '#0000FF',
      });

      // When: 상품에 색상들 연결 (mainImageUrl 포함)
      const redProductColor = await testDataFactory.createProductColor(
        product,
        redValue,
        { mainImageUrl: 'https://example.com/red-main.jpg' },
      );

      const blueProductColor = await testDataFactory.createProductColor(
        product,
        blueValue,
        { mainImageUrl: 'https://example.com/blue-main.jpg' },
      );

      // Then: ProductColor 관계가 정상 생성되어야 함
      expect(redProductColor.productId).toBe(product.id);
      expect(redProductColor.optionValueId).toBe(redValue.id);
      expect(redProductColor.mainImageUrl).toBe(
        'https://example.com/red-main.jpg',
      );
      expect(redProductColor.getMainImage()).toContain('red-main.jpg');

      expect(blueProductColor.productId).toBe(product.id);
      expect(blueProductColor.optionValueId).toBe(blueValue.id);
      expect(blueProductColor.mainImageUrl).toBe(
        'https://example.com/blue-main.jpg',
      );
      expect(blueProductColor.getMainImage()).toContain('blue-main.jpg');

      // 상품 조회 시 productColors 관계 확인
      const productRepository =
        TestSetup.getDataSource().getRepository(ProductEntity);
      const foundProduct = await productRepository.findOne({
        where: { id: product.id },
        relations: ['productColors', 'productColors.images'],
      });

      expect(foundProduct.productColors).toBeDefined();
      expect(foundProduct.productColors).toHaveLength(2);
    });
  });

  describe('Manual Loading Tests', () => {
    it('should manually load Product relationships', async () => {
      // Given: 완전한 상품 데이터 생성
      const brand = await testDataFactory.createBrand();

      // 다국어 상품 생성
      const { product, languages } =
        await testDataFactory.createMultilingualProduct(
          brand,
          { status: ProductStatus.NORMAL },
          {
            name: {
              ko: '테스트 상품',
              en: 'Test Product',
              zh: '测试产品',
            },
          },
        );

      // 이미지 추가
      await testDataFactory.createProductImage(product, {
        imageType: ProductImageType.MAIN,
      });

      // 변형 추가
      await testDataFactory.createProductVariant(product);

      // When: 상품 조회 (relations으로 명시적 로딩)
      const productRepository =
        TestSetup.getDataSource().getRepository(ProductEntity);
      const foundProduct = await productRepository.findOne({
        where: { id: product.id },
        relations: ['images', 'variants', 'productColors'],
      });

      // MultilingualText는 별도 조회 (polymorphic 관계)
      const multilingualRepository = TestSetup.getDataSource().getRepository(
        MultilingualTextEntity,
      );
      const texts = await multilingualRepository.find({
        where: {
          entityType: EntityType.PRODUCT,
          entityId: product.id,
        },
      });

      // Then: relations으로 관계 데이터가 로드되어야 함
      expect(foundProduct).toBeDefined();
      expect(foundProduct.images).toBeDefined();
      expect(foundProduct.images).toHaveLength(1);
      expect(foundProduct.variants).toBeDefined();
      expect(foundProduct.variants).toHaveLength(1);
      expect(foundProduct.productColors).toBeDefined();
      expect(foundProduct.productColors).toHaveLength(0); // 아직 색상 연결 안됨

      // MultilingualText 별도 검증
      expect(texts).toBeDefined();
      expect(texts.length).toBeGreaterThan(0);

      // 다국어 텍스트 내용 검증
      const nameTexts = texts.filter((text) => text.fieldName === 'name');
      expect(nameTexts).toHaveLength(3); // 한국어, 영어, 중국어
    });
  });

  describe('Complex Scenario Tests', () => {
    it('should handle color-based product list scenario', async () => {
      // Given: 색상별 상품 리스트 테스트 데이터 생성
      const testData = await testDataFactory.createProductsForColorList();

      // Then: 데이터가 올바르게 생성되어야 함
      expect(testData.products).toHaveLength(3); // 3개 상품
      expect(testData.colorOptions).toHaveLength(3); // 3개 색상
      expect(testData.variants).toHaveLength(9); // 3 상품 × 3 색상 = 9 변형

      // 각 상품이 모든 색상 변형을 가져야 함
      for (const product of testData.products) {
        const productVariants = testData.variants.filter(
          (v) => v.productId === product.id,
        );
        expect(productVariants).toHaveLength(3); // 각 상품마다 3개 색상
      }
    });
  });
});

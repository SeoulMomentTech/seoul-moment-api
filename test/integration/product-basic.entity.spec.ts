import {
  OptionType,
  ProductImageType,
  ProductStatus,
} from '@app/repository/enum/product.enum';
import { Test, TestingModule } from '@nestjs/testing';

import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('Product Entities Basic Tests', () => {
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
    it('should create basic Brand (sanity check)', async () => {
      // Given & When: 브랜드 생성
      const brand = await testDataFactory.createBrand();

      // Then: 브랜드가 정상 생성되어야 함
      expect(brand.id).toBeDefined();
      expect(brand.status).toBeDefined();
    });

    it('should create Product with Brand relationship', async () => {
      // Given: 브랜드 생성
      const brand = await testDataFactory.createBrand();

      // When: 상품 생성
      const product = await testDataFactory.createProduct(brand, {
        mainImageUrl: 'https://example.com/main.jpg',
        detailInfoImageUrl: 'https://example.com/detail.jpg',
      });

      // Then: 상품이 정상 생성되고 브랜드와 연결되어야 함
      expect(product.id).toBeDefined();
      expect(product.brandId).toBe(brand.id);
      expect(product.status).toBe(ProductStatus.NORMAL);
      expect(product.mainImageUrl).toBe('https://example.com/main.jpg');
      expect(product.detailInfoImageUrl).toBe('https://example.com/detail.jpg');
      expect(product.getMainImage()).toContain('main.jpg');
      expect(product.getDetailInfoImage()).toContain('detail.jpg');
    });

    it('should create ProductImage separately', async () => {
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

    it('should create Option and OptionValue separately', async () => {
      // Given: 옵션 생성
      const option = await testDataFactory.createOption({
        type: OptionType.COLOR,
      });

      // When: 옵션값 생성
      const optionValue = await testDataFactory.createOptionValue(option, {
        colorCode: '#FF0000',
        representativeImageUrl: 'https://example.com/red.jpg',
      });

      // Then: 옵션과 옵션값이 정상 생성되고 연결되어야 함
      expect(option.id).toBeDefined();
      expect(option.type).toBe(OptionType.COLOR);

      expect(optionValue.id).toBeDefined();
      expect(optionValue.optionId).toBe(option.id);
      expect(optionValue.colorCode).toBe('#FF0000');
      expect(optionValue.getRepresentativeImage()).toContain('red.jpg');
    });

    it('should create ProductVariant separately', async () => {
      // Given: 브랜드, 상품 생성
      const brand = await testDataFactory.createBrand();
      const product = await testDataFactory.createProduct(brand);

      // When: 상품 변형 생성
      const variant = await testDataFactory.createProductVariant(product, {
        sku: 'TEST-SIMPLE',
        price: 59000,
        stockQuantity: 10,
      });

      // Then: 변형이 정상 생성되어야 함
      expect(variant.id).toBeDefined();
      expect(variant.productId).toBe(product.id);
      expect(variant.sku).toBe('TEST-SIMPLE');
      expect(variant.getEffectivePrice()).toBe(59000);
      expect(variant.isInStock()).toBe(true);
    });

    it('should create VariantOption mapping', async () => {
      // Given: 모든 기본 Entity 생성
      const brand = await testDataFactory.createBrand();
      const product = await testDataFactory.createProduct(brand);
      const variant = await testDataFactory.createProductVariant(product, {
        sku: 'TEST-MAPPING',
        price: 59000,
      });

      const option = await testDataFactory.createOption({
        type: OptionType.COLOR,
      });
      const optionValue = await testDataFactory.createOptionValue(option);

      // When: 변형-옵션값 매핑 생성
      const variantOption = await testDataFactory.createVariantOption(
        variant,
        optionValue,
      );

      // Then: 매핑이 정상 생성되어야 함
      expect(variantOption.variantId).toBe(variant.id);
      expect(variantOption.optionValueId).toBe(optionValue.id);
    });
  });
});

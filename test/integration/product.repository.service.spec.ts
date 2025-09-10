import { PagingDto } from '@app/common/dto/global.dto';
import { DatabaseSort } from '@app/common/enum/global.enum';
import { ServiceError } from '@app/common/exception/service.error';
import { ProductSortDto } from '@app/repository/dto/product.dto';
import { BrandStatus } from '@app/repository/enum/brand.enum';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import {
  OptionType,
  ProductColorStatus,
  ProductSortColumn,
  ProductStatus,
} from '@app/repository/enum/product.enum';
import { ProductRepositoryService } from '@app/repository/service/product.repository.service';
import { Test, TestingModule } from '@nestjs/testing';

import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('ProductRepositoryService Integration Tests', () => {
  let productRepositoryService: ProductRepositoryService;
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    module = await Test.createTestingModule({
      imports: [TestDatabaseModule],
      providers: [ProductRepositoryService],
    }).compile();

    productRepositoryService = module.get<ProductRepositoryService>(
      ProductRepositoryService,
    );
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

  describe('findBanner', () => {
    it('빈 배너 목록을 반환해야 함', async () => {
      const banners = await productRepositoryService.findBanner();

      expect(banners).toEqual([]);
    });

    it('생성된 배너들을 반환해야 함', async () => {
      // Given: 배너들 생성
      const banner1 = await testDataFactory.createProductBanner({
        image: 'https://example.com/banner1.jpg',
        sortOrder: 1,
      });
      const banner2 = await testDataFactory.createProductBanner({
        image: 'https://example.com/banner2.jpg',
        sortOrder: 2,
      });

      // When: 배너 목록 조회
      const banners = await productRepositoryService.findBanner();

      // Then: 모든 배너가 반환되어야 함
      expect(banners).toHaveLength(2);
      expect(banners.map((b) => b.id).sort()).toEqual(
        [banner1.id, banner2.id].sort(),
      );
      expect(banners.find((b) => b.id === banner1.id)?.image).toBe(
        'https://example.com/banner1.jpg',
      );
      expect(banners.find((b) => b.id === banner2.id)?.image).toBe(
        'https://example.com/banner2.jpg',
      );
    });

    it('sortOrder에 따라 정렬된 배너들을 반환해야 함', async () => {
      // Given: sortOrder가 다른 배너들 생성 (역순으로 생성하여 정렬 테스트)
      const banner3 = await testDataFactory.createProductBanner({
        image: 'https://example.com/banner3.jpg',
        sortOrder: 3,
      });
      const banner1 = await testDataFactory.createProductBanner({
        image: 'https://example.com/banner1.jpg',
        sortOrder: 1,
      });
      const banner2 = await testDataFactory.createProductBanner({
        image: 'https://example.com/banner2.jpg',
        sortOrder: 2,
      });

      // When: 배너 목록 조회
      const banners = await productRepositoryService.findBanner();

      // Then: 생성한 3개 배너만 반환되고 sortOrder 순으로 정렬되어야 함
      const createdBannerIds = [banner1.id, banner2.id, banner3.id];
      const actualBanners = banners.filter((b) =>
        createdBannerIds.includes(b.id),
      );

      expect(actualBanners).toHaveLength(3);
      expect(actualBanners[0].sortOrder).toBeLessThanOrEqual(
        actualBanners[1].sortOrder,
      );
      expect(actualBanners[1].sortOrder).toBeLessThanOrEqual(
        actualBanners[2].sortOrder,
      );
    });
  });

  describe('findCategory', () => {
    it('빈 카테고리 목록을 반환해야 함', async () => {
      const categories = await productRepositoryService.findCategory();

      expect(categories).toEqual([]);
    });

    it('생성된 카테고리들을 반환해야 함', async () => {
      // Given: 카테고리들 생성
      const category1 = await testDataFactory.createProductCategory({
        sortOrder: 2,
      });
      const category2 = await testDataFactory.createProductCategory({
        sortOrder: 1,
      });

      // When: 카테고리 목록 조회
      const categories = await productRepositoryService.findCategory();

      // Then: sortOrder 순으로 정렬된 카테고리가 반환되어야 함
      expect(categories).toHaveLength(2);
      expect(categories[0].id).toBe(category2.id); // sortOrder 1
      expect(categories[1].id).toBe(category1.id); // sortOrder 2
    });
  });

  describe('findProductColor', () => {
    beforeEach(async () => {
      // 각 테스트 전에 완전 정리
      await TestSetup.clearDatabase();

      // 추가적으로 직접 테이블 정리
      const dataSource = TestSetup.getDataSource();
      await dataSource.query('TRUNCATE TABLE product_color CASCADE;');
      await dataSource.query('TRUNCATE TABLE product CASCADE;');
      await dataSource.query('TRUNCATE TABLE brand CASCADE;');
      await dataSource.query('TRUNCATE TABLE category CASCADE;');
      await dataSource.query('TRUNCATE TABLE "option" CASCADE;');
      await dataSource.query('TRUNCATE TABLE option_value CASCADE;');
      await dataSource.query('TRUNCATE TABLE multilingual_text CASCADE;');
    });

    it('빈 상품 색상 목록을 반환해야 함', async () => {
      const pageDto = PagingDto.from(1, 10);
      const [colors, totalCount] =
        await productRepositoryService.findProductColor(pageDto);

      expect(colors).toEqual([]);
      expect(totalCount).toBe(0);
    });

    it('정상 상품 색상들만 반환해야 함', async () => {
      // Given: 정상 브랜드와 정상 상품들 생성
      const brand = await testDataFactory.createBrand({
        status: BrandStatus.NORMAL,
      });
      const category = await testDataFactory.createCategory();
      const product1 = await testDataFactory.createProduct(brand, {
        status: ProductStatus.NORMAL,
        categoryId: category.id,
      });
      const product2 = await testDataFactory.createProduct(brand, {
        status: ProductStatus.NORMAL,
        categoryId: category.id,
      });

      // Option과 OptionValue 생성
      const option = await testDataFactory.createOption();
      const optionValue1 = await testDataFactory.createOptionValue(option);
      const optionValue2 = await testDataFactory.createOptionValue(option);
      const optionValue3 = await testDataFactory.createOptionValue(option);

      // 정상 상품 색상들
      const color1 = await testDataFactory.createProductColor(
        product1,
        optionValue1,
        {
          status: ProductColorStatus.NORMAL,
          price: 10000,
        },
      );
      const color2 = await testDataFactory.createProductColor(
        product2,
        optionValue2,
        {
          status: ProductColorStatus.NORMAL,
          price: 20000,
        },
      );

      // 차단된 상품 색상 (결과에 포함되지 않아야 함)
      await testDataFactory.createProductColor(product1, optionValue3, {
        status: ProductColorStatus.BLOCK,
        price: 30000,
      });

      // When: 상품 색상 목록 조회
      const pageDto = PagingDto.from(1, 10);
      const [colors, totalCount] =
        await productRepositoryService.findProductColor(pageDto);

      // Then: 정상 상태의 색상들만 반환되어야 함 (차단된 것 제외)
      expect(colors).toHaveLength(2);
      expect(totalCount).toBe(2);
      expect(colors.map((c) => c.id).sort()).toEqual(
        [color1.id, color2.id].sort(),
      );
    });

    it('브랜드별 필터링이 동작해야 함', async () => {
      // Given: 서로 다른 브랜드의 상품들
      const brand1 = await testDataFactory.createBrand({
        status: BrandStatus.NORMAL,
      });
      const brand2 = await testDataFactory.createBrand({
        status: BrandStatus.NORMAL,
      });
      const category = await testDataFactory.createCategory();

      const product1 = await testDataFactory.createProduct(brand1, {
        status: ProductStatus.NORMAL,
        categoryId: category.id,
      });
      const product2 = await testDataFactory.createProduct(brand2, {
        status: ProductStatus.NORMAL,
        categoryId: category.id,
      });

      // Option과 OptionValue 생성
      const option = await testDataFactory.createOption();
      const optionValue1 = await testDataFactory.createOptionValue(option);
      const optionValue2 = await testDataFactory.createOptionValue(option);

      const color1 = await testDataFactory.createProductColor(
        product1,
        optionValue1,
        {
          status: ProductColorStatus.NORMAL,
          price: 10000,
        },
      );
      const color2 = await testDataFactory.createProductColor(
        product2,
        optionValue2,
        {
          status: ProductColorStatus.NORMAL,
          price: 20000,
        },
      );

      // When: brand2로 필터링하여 조회 (더 명확하게 구분하기 위해)
      const pageDto = PagingDto.from(1, 10);
      const [colors, totalCount] =
        await productRepositoryService.findProductColor(
          pageDto,
          undefined,
          brand2.id, // brand2로 필터링
        );

      // Then: brand2의 상품 색상만 반환되어야 함
      expect(colors).toHaveLength(1);
      expect(totalCount).toBe(1);
      expect(colors[0].id).toBe(color2.id);
      expect(colors[0].product.brand.id).toBe(brand2.id);
      expect(colors[0].product.brandId).toBe(brand2.id);
    });

    it('가격 기준 정렬이 동작해야 함 (할인가 우선)', async () => {
      // Given: 다양한 가격의 상품들
      const brand = await testDataFactory.createBrand({
        status: BrandStatus.NORMAL,
      });
      const category = await testDataFactory.createCategory();
      const product = await testDataFactory.createProduct(brand, {
        status: ProductStatus.NORMAL,
        categoryId: category.id,
      });

      // Option과 OptionValue 생성
      const option = await testDataFactory.createOption();
      const optionValue1 = await testDataFactory.createOptionValue(option);
      const optionValue2 = await testDataFactory.createOptionValue(option);

      // 할인가가 있는 상품 (할인가 기준으로 정렬)
      const color1 = await testDataFactory.createProductColor(
        product,
        optionValue1,
        {
          status: ProductColorStatus.NORMAL,
          price: 30000,
          discountPrice: 15000, // 실제 정렬 기준
        },
      );

      // 정가만 있는 상품
      const color2 = await testDataFactory.createProductColor(
        product,
        optionValue2,
        {
          status: ProductColorStatus.NORMAL,
          price: 10000, // 할인가 없으므로 정가 기준
        },
      );

      // When: 가격 기준 오름차순 정렬, 특정 브랜드로 필터링해서 격리
      const pageDto = PagingDto.from(1, 10);
      const sortDto = ProductSortDto.from(
        ProductSortColumn.PRICE,
        DatabaseSort.ASC,
      );
      const [colors, totalCount] =
        await productRepositoryService.findProductColor(
          pageDto,
          sortDto,
          brand.id, // 특정 브랜드로 필터링해서 다른 테스트 데이터와 격리
        );

      // Then: 실제 판매가 기준으로 정렬되어야 함 (10000, 15000)
      expect(colors).toHaveLength(2);
      expect(totalCount).toBe(2);
      expect(colors[0].id).toBe(color2.id); // 10000
      expect(colors[1].id).toBe(color1.id); // 15000 (할인가)

      // 브랜드 확인
      expect(colors[0].product.brand.id).toBe(brand.id);
      expect(colors[1].product.brand.id).toBe(brand.id);
    });

    it('페이징이 정상 동작해야 함', async () => {
      // Given: 5개 상품 생성
      const brand = await testDataFactory.createBrand({
        status: BrandStatus.NORMAL,
      });
      const category = await testDataFactory.createCategory();
      const product = await testDataFactory.createProduct(brand, {
        status: ProductStatus.NORMAL,
        categoryId: category.id,
      });

      // Option과 OptionValue들 생성
      const option = await testDataFactory.createOption();

      const colors = [];
      for (let i = 1; i <= 5; i++) {
        const optionValue = await testDataFactory.createOptionValue(option);
        const color = await testDataFactory.createProductColor(
          product,
          optionValue,
          {
            status: ProductColorStatus.NORMAL,
            price: i * 1000,
          },
        );
        colors.push(color);
      }

      // When: 첫 번째 페이지 (2개씩) - 브랜드로 필터링
      const [page1, totalCount1] =
        await productRepositoryService.findProductColor(
          PagingDto.from(1, 2),
          undefined,
          brand.id, // 다른 테스트 데이터와 격리
        );

      // Then: 2개만 반환되어야 하지만 전체 개수는 5개
      expect(page1).toHaveLength(2);
      expect(totalCount1).toBe(5);

      // When: 두 번째 페이지 (2개씩)
      const [page2, totalCount2] =
        await productRepositoryService.findProductColor(
          PagingDto.from(2, 2),
          undefined,
          brand.id,
        );

      // Then: 2개만 반환되어야 하지만 전체 개수는 5개
      expect(page2).toHaveLength(2);
      expect(totalCount2).toBe(5);

      // When: 세 번째 페이지 (2개씩)
      const [page3, totalCount3] =
        await productRepositoryService.findProductColor(
          PagingDto.from(3, 2),
          undefined,
          brand.id,
        );

      // Then: 1개만 반환되어야 하지만 전체 개수는 5개
      expect(page3).toHaveLength(1);
      expect(totalCount3).toBe(5);
    });
  });

  describe('getProductColorDetail', () => {
    beforeEach(async () => {
      await TestSetup.clearDatabase();
    });

    it('존재하는 상품 색상 상세 정보를 반환해야 함', async () => {
      // Given: 정상 브랜드, 상품, 상품 색상 생성
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
          status: ProductColorStatus.NORMAL,
          price: 10000,
        },
      );

      // ProductColorImage 생성
      await testDataFactory.createProductColorImage(productColor, {
        imageUrl: 'https://example.com/image1.jpg',
        sortOrder: 1,
      });

      // When: 상품 색상 상세 정보 조회
      const result = await productRepositoryService.getProductColorDetail(
        productColor.id,
      );

      // Then: 정상적으로 상세 정보가 반환되어야 함
      expect(result).toBeDefined();
      expect(result.id).toBe(productColor.id);
      expect(result.product).toBeDefined();
      expect(result.product.brand).toBeDefined();
      expect(result.images).toBeDefined();
      expect(result.images).toHaveLength(1);
    });

    it('존재하지 않는 상품 색상 조회 시 에러가 발생해야 함', async () => {
      // When & Then: 존재하지 않는 ID로 조회 시 에러 발생
      await expect(
        productRepositoryService.getProductColorDetail(999999),
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
        productRepositoryService.getProductColorDetail(productColor.id),
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('getProductOptionTypes', () => {
    beforeEach(async () => {
      await TestSetup.clearDatabase();
    });

    it('상품의 옵션 타입들을 반환해야 함', async () => {
      // Given: 다양한 옵션이 있는 상품 생성
      const brand = await testDataFactory.createBrand({
        status: BrandStatus.NORMAL,
      });
      const category = await testDataFactory.createCategory();
      const product = await testDataFactory.createProduct(brand, {
        status: ProductStatus.NORMAL,
        categoryId: category.id,
      });

      // 색상과 사이즈 옵션 생성
      const colorOption = await testDataFactory.createOption({
        type: OptionType.COLOR,
      });
      const sizeOption = await testDataFactory.createOption({
        type: OptionType.SIZE,
      });

      const colorValue = await testDataFactory.createOptionValue(colorOption);
      const sizeValue = await testDataFactory.createOptionValue(sizeOption);

      // 상품 variant 생성
      const variant = await testDataFactory.createProductVariant(product, {
        sku: 'TEST-SKU-001',
      });

      // variant-option 연결
      await testDataFactory.createVariantOption(variant, colorValue);
      await testDataFactory.createVariantOption(variant, sizeValue);

      // When: 상품의 옵션 타입들 조회
      const optionTypes = await productRepositoryService.getProductOptionTypes(
        product.id,
      );

      // Then: 생성한 옵션 타입들이 반환되어야 함
      expect(optionTypes).toHaveLength(2);
      expect(optionTypes).toContain(OptionType.COLOR);
      expect(optionTypes).toContain(OptionType.SIZE);
    });

    it('옵션이 없는 상품의 경우 빈 배열을 반환해야 함', async () => {
      // Given: 옵션이 없는 상품 생성
      const brand = await testDataFactory.createBrand({
        status: BrandStatus.NORMAL,
      });
      const category = await testDataFactory.createCategory();
      const product = await testDataFactory.createProduct(brand, {
        status: ProductStatus.NORMAL,
        categoryId: category.id,
      });

      // When: 상품의 옵션 타입들 조회
      const optionTypes = await productRepositoryService.getProductOptionTypes(
        product.id,
      );

      // Then: 빈 배열이 반환되어야 함
      expect(optionTypes).toEqual([]);
    });
  });

  describe('getProductOption', () => {
    beforeEach(async () => {
      await TestSetup.clearDatabase();
    });

    it('특정 타입의 상품 옵션값들을 반환해야 함', async () => {
      // Given: 언어와 상품 설정
      const language = await testDataFactory.createLanguage({
        code: LanguageCode.ENGLISH,
        name: 'Test Language Option',
      });
      const brand = await testDataFactory.createBrand({
        status: BrandStatus.NORMAL,
      });
      const category = await testDataFactory.createCategory();
      const product = await testDataFactory.createProduct(brand, {
        status: ProductStatus.NORMAL,
        categoryId: category.id,
      });

      // 색상 옵션 생성
      const colorOption = await testDataFactory.createOption({
        type: OptionType.COLOR,
      });

      const redValue = await testDataFactory.createOptionValue(colorOption, {
        sortOrder: 1,
      });
      const blueValue = await testDataFactory.createOptionValue(colorOption, {
        sortOrder: 2,
      });

      // 다국어 텍스트 생성
      await testDataFactory.createMultilingualText(
        EntityType.OPTION_VALUE,
        redValue.id,
        'value',
        language,
        'Red',
      );
      await testDataFactory.createMultilingualText(
        EntityType.OPTION_VALUE,
        blueValue.id,
        'value',
        language,
        'Blue',
      );

      // 상품 variant 생성
      const variant = await testDataFactory.createProductVariant(product, {
        sku: 'TEST-SKU-001',
      });

      // variant-option 연결
      await testDataFactory.createVariantOption(variant, redValue);
      await testDataFactory.createVariantOption(variant, blueValue);

      // When: 색상 옵션값들 조회
      const colorOptions = await productRepositoryService.getProductOption(
        OptionType.COLOR,
        product.id,
        language.id,
      );

      // Then: 정렬된 옵션값들이 반환되어야 함
      expect(colorOptions).toHaveLength(2);
      expect(colorOptions[0].value).toBe('Red');
      expect(colorOptions[1].value).toBe('Blue');
      expect(colorOptions[0].id).toBe(redValue.id);
      expect(colorOptions[1].id).toBe(blueValue.id);
    });

    it('해당 타입의 옵션이 없는 경우 빈 배열을 반환해야 함', async () => {
      // Given: 사이즈 옵션만 있는 상품
      const language = await testDataFactory.createLanguage({
        code: LanguageCode.CHINESE,
        name: 'Test Language Empty',
      });
      const brand = await testDataFactory.createBrand({
        status: BrandStatus.NORMAL,
      });
      const category = await testDataFactory.createCategory();
      const product = await testDataFactory.createProduct(brand, {
        status: ProductStatus.NORMAL,
        categoryId: category.id,
      });

      const sizeOption = await testDataFactory.createOption({
        type: OptionType.SIZE,
      });
      const sizeValue = await testDataFactory.createOptionValue(sizeOption);

      const variant = await testDataFactory.createProductVariant(product, {
        sku: 'TEST-SKU-001',
      });
      await testDataFactory.createVariantOption(variant, sizeValue);

      // When: 색상 옵션값들 조회 (존재하지 않음)
      const colorOptions = await productRepositoryService.getProductOption(
        OptionType.COLOR,
        product.id,
        language.id,
      );

      // Then: 빈 배열이 반환되어야 함
      expect(colorOptions).toEqual([]);
    });
  });
});

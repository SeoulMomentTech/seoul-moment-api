/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ServiceError } from '@app/common/exception/service.error';
import { BrandStatus } from '@app/repository/enum/brand.enum';
import { EntityEnum } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { Test, TestingModule } from '@nestjs/testing';

import { BrandModule } from '../../apps/api/src/module/brand/brand.module';
import { BrandService } from '../../apps/api/src/module/brand/brand.service';
import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('BrandService Multilingual Integration Tests', () => {
  let brandService: BrandService;
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    module = await Test.createTestingModule({
      imports: [TestDatabaseModule, BrandModule],
    }).compile();

    brandService = module.get<BrandService>(BrandService);
    testDataFactory = new TestDataFactory(TestSetup.getDataSource());
  });

  afterAll(async () => {
    await module.close();
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    await TestSetup.clearDatabase();
  });

  describe('getBrandIntroduce with multilingual support', () => {
    it('should return brand in Korean by default', async () => {
      // Given: Create multilingual brand
      const { brand, languages } =
        await testDataFactory.createMultilingualBrand(
          { status: BrandStatus.NORMAL },
          {
            name: {
              [LanguageCode.KOREAN]: '서울모먼트',
              [LanguageCode.ENGLISH]: 'Seoul Moment',
              [LanguageCode.CHINESE]: '首尔时刻',
            },
            description: {
              [LanguageCode.KOREAN]: '서울의 특별한 순간들',
              [LanguageCode.ENGLISH]: 'Special moments of Seoul',
              [LanguageCode.CHINESE]: '首尔的特殊时刻',
            },
          },
        );

      // When: Get brand introduce without language specification
      const result = await brandService.getBrandIntroduce(brand.id);

      // Then: Should return Korean by default
      expect(result.name).toBe('서울모먼트');
      expect(result.description).toBe('서울의 특별한 순간들');
    });

    it('should return brand in specified language', async () => {
      // Given: Create multilingual brand
      const { brand } = await testDataFactory.createMultilingualBrand(
        { status: BrandStatus.NORMAL },
        {
          name: {
            [LanguageCode.KOREAN]: '서울모먼트',
            [LanguageCode.ENGLISH]: 'Seoul Moment',
            [LanguageCode.CHINESE]: '首尔时刻',
          },
          description: {
            [LanguageCode.KOREAN]: '서울의 특별한 순간들',
            [LanguageCode.ENGLISH]: 'Special moments of Seoul',
            [LanguageCode.CHINESE]: '首尔的特殊时刻',
          },
        },
      );

      // When: Get brand introduce in English
      const englishResult = await brandService.getBrandIntroduce(
        brand.id,
        LanguageCode.ENGLISH,
      );

      // Then: Should return English content
      expect(englishResult.name).toBe('Seoul Moment');
      expect(englishResult.description).toBe('Special moments of Seoul');

      // When: Get brand introduce in Chinese
      const chineseResult = await brandService.getBrandIntroduce(
        brand.id,
        LanguageCode.CHINESE,
      );

      // Then: Should return Chinese content
      expect(chineseResult.name).toBe('首尔时刻');
      expect(chineseResult.description).toBe('首尔的特殊时刻');
    });

    it('should return empty strings when no multilingual content exists', async () => {
      // Given: Create brand without multilingual content
      const brand = await testDataFactory.createBrand({
        status: BrandStatus.NORMAL,
      });

      // When: Get brand introduce
      const result = await brandService.getBrandIntroduce(brand.id);

      // Then: Should return empty strings
      expect(result.name).toBe('');
      expect(result.description).toBe('');
    });

    it('should handle multilingual sections', async () => {
      // Given: Create brand with multilingual sections
      const brand = await testDataFactory.createFullBrand({
        brand: { status: BrandStatus.NORMAL },
        sections: [{ sortOrder: 1 }, { sortOrder: 2 }],
      });

      const languages = await testDataFactory.createDefaultLanguages();
      const sectionIds = brand.brandSectionList
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((section) => section.id);

      // Create multilingual texts for sections
      await Promise.all([
        testDataFactory.createMultilingualText(
          EntityEnum.BRAND_SECTION,
          sectionIds[0],
          'title',
          languages.korean,
          '브랜드 스토리',
        ),
        testDataFactory.createMultilingualText(
          EntityEnum.BRAND_SECTION,
          sectionIds[0],
          'content',
          languages.korean,
          '우리 브랜드의 이야기입니다.',
        ),
        testDataFactory.createMultilingualText(
          EntityEnum.BRAND_SECTION,
          sectionIds[0],
          'title',
          languages.english,
          'Brand Story',
        ),
        testDataFactory.createMultilingualText(
          EntityEnum.BRAND_SECTION,
          sectionIds[0],
          'content',
          languages.english,
          'This is our brand story.',
        ),
        testDataFactory.createMultilingualText(
          EntityEnum.BRAND_SECTION,
          sectionIds[1],
          'title',
          languages.korean,
          '제품 소개',
        ),
      ]);

      // When: Get brand introduce in Korean
      const koreanResult = await brandService.getBrandIntroduce(
        brand.id,
        LanguageCode.KOREAN,
      );

      // Then: Should return Korean section content
      expect(koreanResult.section).toHaveLength(2);
      expect(koreanResult.section[0].title).toBe('브랜드 스토리');
      expect(koreanResult.section[0].content).toBe(
        '우리 브랜드의 이야기입니다.',
      );
      expect(koreanResult.section[1].title).toBe('제품 소개');
      expect(koreanResult.section[1].content).toBe('');

      // When: Get brand introduce in English
      const englishResult = await brandService.getBrandIntroduce(
        brand.id,
        LanguageCode.ENGLISH,
      );

      // Then: Should return English content with Korean fallback
      expect(englishResult.section[0].title).toBe('Brand Story');
      expect(englishResult.section[0].content).toBe('This is our brand story.');
      expect(englishResult.section[1].title).toBe(''); // No English text, no fallback
    });

    it('should throw ServiceError for non-existent brand', async () => {
      // When & Then: Should throw error for non-existent brand
      await expect(
        brandService.getBrandIntroduce(999, LanguageCode.KOREAN),
      ).rejects.toThrow(ServiceError);
    });

    it('should throw ServiceError for blocked brand', async () => {
      // Given: Create blocked brand
      const { brand } = await testDataFactory.createMultilingualBrand(
        { status: BrandStatus.BLOCK },
        {
          name: { [LanguageCode.KOREAN]: '차단된 브랜드' },
        },
      );

      // When & Then: Should throw error
      await expect(
        brandService.getBrandIntroduce(brand.id, LanguageCode.KOREAN),
      ).rejects.toThrow(ServiceError);
    });

    it('should handle complex multilingual brand with all features', async () => {
      // Given: Create comprehensive multilingual brand
      const brand = await testDataFactory.createFullBrand({
        brand: { status: BrandStatus.NORMAL },
        banners: [
          { sortOrder: 1, imageUrl: 'banner1.jpg' },
          { sortOrder: 2, imageUrl: 'banner2.jpg' },
        ],
        sections: [
          {
            sortOrder: 1,
            images: [
              { sortOrder: 1, imageUrl: 'section1-1.jpg' },
              { sortOrder: 2, imageUrl: 'section1-2.jpg' },
            ],
          },
          {
            sortOrder: 2,
            images: [{ sortOrder: 1, imageUrl: 'section2-1.jpg' }],
          },
        ],
      });

      const languages = await testDataFactory.createDefaultLanguages();

      // Create multilingual texts for brand
      await Promise.all([
        testDataFactory.createMultilingualText(
          EntityEnum.BRAND,
          brand.id,
          'name',
          languages.korean,
          '서울모먼트',
        ),
        testDataFactory.createMultilingualText(
          EntityEnum.BRAND,
          brand.id,
          'description',
          languages.korean,
          '서울의 특별한 순간들을 담은 브랜드입니다.',
        ),
        testDataFactory.createMultilingualText(
          EntityEnum.BRAND,
          brand.id,
          'name',
          languages.english,
          'Seoul Moment',
        ),
      ]);

      // Create multilingual texts for sections
      const sectionIds = brand.brandSectionList
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => s.id);
      await Promise.all([
        testDataFactory.createMultilingualText(
          EntityEnum.BRAND_SECTION,
          sectionIds[0],
          'title',
          languages.korean,
          '브랜드 스토리',
        ),
        testDataFactory.createMultilingualText(
          EntityEnum.BRAND_SECTION,
          sectionIds[0],
          'content',
          languages.korean,
          '우리는 서울의 아름다운 순간들을 포착합니다.',
        ),
        testDataFactory.createMultilingualText(
          EntityEnum.BRAND_SECTION,
          sectionIds[1],
          'title',
          languages.english,
          'Our Products',
        ),
      ]);

      // When: Get brand introduce in Korean
      const result = await brandService.getBrandIntroduce(
        brand.id,
        LanguageCode.KOREAN,
      );

      // Then: Should return complete multilingual brand data
      expect(result.id).toBe(brand.id);
      expect(result.name).toBe('서울모먼트');
      expect(result.description).toBe(
        '서울의 특별한 순간들을 담은 브랜드입니다.',
      );
      expect(result.bannerList).toHaveLength(2);
      expect(result.bannerList[0]).toContain('banner1.jpg');
      expect(result.bannerList[1]).toContain('banner2.jpg');

      expect(result.section).toHaveLength(2);
      expect(result.section[0].title).toBe('브랜드 스토리');
      expect(result.section[0].content).toBe(
        '우리는 서울의 아름다운 순간들을 포착합니다.',
      );
      expect(result.section[0].imageList).toHaveLength(2);
      expect(result.section[0].imageList[0]).toContain('section1-1.jpg');
      expect(result.section[0].imageList[1]).toContain('section1-2.jpg');

      expect(result.section[1].title).toBe(''); // No Korean text, no fallback
      expect(result.section[1].content).toBe(''); // No content in any language
      expect(result.section[1].imageList).toHaveLength(1);
      expect(result.section[1].imageList[0]).toContain('section2-1.jpg');
    });
  });
});

import { BrandStatus } from '@app/repository/enum/brand.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { Test, TestingModule } from '@nestjs/testing';

import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('LanguageRepositoryService Integration Tests', () => {
  let languageRepositoryService: LanguageRepositoryService;
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    module = await Test.createTestingModule({
      imports: [TestDatabaseModule],
      providers: [LanguageRepositoryService],
    }).compile();

    languageRepositoryService = module.get<LanguageRepositoryService>(
      LanguageRepositoryService,
    );
    testDataFactory = new TestDataFactory(TestSetup.getDataSource());
  });

  afterAll(async () => {
    await module.close();
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    await TestSetup.clearDatabase();
  });

  describe('Language Management', () => {
    it('should find all active languages', async () => {
      // Given: Create test languages
      const languages = await Promise.all([
        testDataFactory.createLanguage({
          code: LanguageCode.KOREAN,
          name: '한국어',
          englishName: 'Korean',
          isActive: true,
          sortOrder: 1,
        }),
        testDataFactory.createLanguage({
          code: LanguageCode.ENGLISH,
          name: 'English',
          englishName: 'English',
          isActive: true,
          sortOrder: 2,
        }),
        testDataFactory.createLanguage({
          code: LanguageCode.CHINESE,
          name: '中文',
          englishName: 'Chinese',
          isActive: false, // Inactive
          sortOrder: 3,
        }),
      ]);

      // When
      const result = await languageRepositoryService.findAllActiveLanguages();

      // Then: Should return only active languages, sorted by sortOrder
      expect(result).toHaveLength(2);
      expect(result[0].code).toBe(LanguageCode.KOREAN);
      expect(result[1].code).toBe(LanguageCode.ENGLISH);
    });

    it('should find language by code', async () => {
      // Given
      const korean = await testDataFactory.createLanguage({
        code: LanguageCode.KOREAN,
        name: '한국어',
        isActive: true,
      });

      // When
      const result = await languageRepositoryService.findLanguageByCode(
        LanguageCode.KOREAN,
      );

      // Then
      expect(result).toBeDefined();
      expect(result.code).toBe(LanguageCode.KOREAN);
      expect(result.name).toBe('한국어');
    });

    it('should return null for inactive language', async () => {
      // Given: Create inactive language
      await testDataFactory.createLanguage({
        code: LanguageCode.CHINESE,
        name: '中文',
        isActive: false,
      });

      // When
      const result = await languageRepositoryService.findLanguageByCode(
        LanguageCode.CHINESE,
      );

      // Then
      expect(result).toBeNull();
    });
  });

  describe('Multilingual Text Management', () => {
    it('should save and find multilingual text', async () => {
      // Given: Create language and brand
      const korean = await testDataFactory.createLanguage({
        code: LanguageCode.KOREAN,
        name: '한국어',
        isActive: true,
      });

      const brand = await testDataFactory.createBrand({
        status: BrandStatus.NORMAL,
      });

      // When: Save multilingual text
      await languageRepositoryService.saveMultilingualText(
        'Brand',
        brand.id,
        'name',
        korean.id,
        '서울모먼트',
      );

      // Then: Find multilingual text
      const result = await languageRepositoryService.findMultilingualTexts(
        'Brand',
        brand.id,
        LanguageCode.KOREAN,
      );

      expect(result).toHaveLength(1);
      expect(result[0].textContent).toBe('서울모먼트');
      expect(result[0].fieldName).toBe('name');
      expect(result[0].entityType).toBe('Brand');
    });

    it('should update existing multilingual text', async () => {
      // Given: Create language, brand, and initial text
      const korean = await testDataFactory.createLanguage({
        code: LanguageCode.KOREAN,
        name: '한국어',
        isActive: true,
      });

      const brand = await testDataFactory.createBrand({
        status: BrandStatus.NORMAL,
      });

      await languageRepositoryService.saveMultilingualText(
        'Brand',
        brand.id,
        'name',
        korean.id,
        '초기 이름',
      );

      // When: Update text
      await languageRepositoryService.saveMultilingualText(
        'Brand',
        brand.id,
        'name',
        korean.id,
        '수정된 이름',
      );

      // Then: Should have updated content
      const result = await languageRepositoryService.findMultilingualTexts(
        'Brand',
        brand.id,
        LanguageCode.KOREAN,
      );

      expect(result).toHaveLength(1);
      expect(result[0].textContent).toBe('수정된 이름');
    });

    it('should find multilingual texts by multiple entities', async () => {
      // Given: Create languages, brand, and sections
      const korean = await testDataFactory.createLanguage({
        code: LanguageCode.KOREAN,
        name: '한국어',
        isActive: true,
      });

      const english = await testDataFactory.createLanguage({
        code: LanguageCode.ENGLISH,
        name: 'English',
        isActive: true,
      });

      const brand = await testDataFactory.createFullBrand({
        brand: { status: BrandStatus.NORMAL },
        sections: [{ sortOrder: 1 }, { sortOrder: 2 }],
      });

      const sectionIds = brand.brandSectionList.map((section) => section.id);

      // When: Save multilingual texts for sections
      await Promise.all([
        languageRepositoryService.saveMultilingualText(
          'BrandSection',
          sectionIds[0],
          'title',
          korean.id,
          '첫 번째 섹션',
        ),
        languageRepositoryService.saveMultilingualText(
          'BrandSection',
          sectionIds[1],
          'title',
          korean.id,
          '두 번째 섹션',
        ),
        languageRepositoryService.saveMultilingualText(
          'BrandSection',
          sectionIds[0],
          'title',
          english.id,
          'First Section',
        ),
      ]);

      // Then: Find texts for all sections in Korean
      const koreanTexts =
        await languageRepositoryService.findMultilingualTextsByEntities(
          'BrandSection',
          sectionIds,
          LanguageCode.KOREAN,
        );

      expect(koreanTexts).toHaveLength(2);
      expect(koreanTexts.map((t) => t.textContent).sort()).toEqual([
        '두 번째 섹션',
        '첫 번째 섹션',
      ]);

      // And: Find texts for all sections in English
      const englishTexts =
        await languageRepositoryService.findMultilingualTextsByEntities(
          'BrandSection',
          sectionIds,
          LanguageCode.ENGLISH,
        );

      expect(englishTexts).toHaveLength(1);
      expect(englishTexts[0].textContent).toBe('First Section');
    });

    it('should delete multilingual texts', async () => {
      // Given: Create language, brand, and multilingual texts
      const korean = await testDataFactory.createLanguage({
        code: LanguageCode.KOREAN,
        name: '한국어',
        isActive: true,
      });

      const brand = await testDataFactory.createBrand({
        status: BrandStatus.NORMAL,
      });

      await Promise.all([
        languageRepositoryService.saveMultilingualText(
          'Brand',
          brand.id,
          'name',
          korean.id,
          '서울모먼트',
        ),
        languageRepositoryService.saveMultilingualText(
          'Brand',
          brand.id,
          'description',
          korean.id,
          '브랜드 설명',
        ),
      ]);

      // When: Delete multilingual texts
      await languageRepositoryService.deleteMultilingualTexts(
        'Brand',
        brand.id,
      );

      // Then: Should have no texts
      const result = await languageRepositoryService.findMultilingualTexts(
        'Brand',
        brand.id,
        LanguageCode.KOREAN,
      );

      expect(result).toHaveLength(0);
    });
  });
});

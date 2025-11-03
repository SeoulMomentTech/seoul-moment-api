import { CategoryEntity } from '@app/repository/entity/category.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { Test, TestingModule } from '@nestjs/testing';

import { CategoryModule } from '../../apps/api/src/module/category/category.module';
import { CategoryService } from '../../apps/api/src/module/category/category.service';
import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('CategoryService Integration Tests', () => {
  let categoryService: CategoryService;
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize(); // 트랜잭션 초기화는 TestSetup에서 처리

    module = await Test.createTestingModule({
      imports: [TestDatabaseModule, CategoryModule],
    }).compile();

    categoryService = module.get<CategoryService>(CategoryService);
    testDataFactory = new TestDataFactory(TestSetup.getDataSource());
  });

  afterAll(async () => {
    await module.close();
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    await TestSetup.clearDatabase();
  });

  describe('getCategory', () => {
    it('빈 카테고리 목록을 반환해야 합니다', async () => {
      // When
      const result = await categoryService.getCategory(LanguageCode.KOREAN);

      // Then
      expect(result).toEqual([]);
    });

    it('다국어 카테고리 목록을 조회해야 합니다', async () => {
      // Given
      const { category, languages } =
        await testDataFactory.createMultilingualCategory(
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
      const koResult = await categoryService.getCategory(LanguageCode.KOREAN);
      const enResult = await categoryService.getCategory(LanguageCode.ENGLISH);
      const zhResult = await categoryService.getCategory(LanguageCode.TAIWAN);

      // Then
      expect(koResult).toHaveLength(1);
      expect(koResult[0]).toMatchObject({
        id: category.id,
        name: '한국 카테고리',
      });

      expect(enResult).toHaveLength(1);
      expect(enResult[0]).toMatchObject({
        id: category.id,
        name: 'Korean Category',
      });

      expect(zhResult).toHaveLength(1);
      expect(zhResult[0]).toMatchObject({
        id: category.id,
        name: '韩国类别',
      });
    });

    it('sortOrder 순으로 카테고리를 반환해야 합니다', async () => {
      // Given - 다국어 텍스트가 포함된 카테고리를 sortOrder 순서대로 생성
      const { category: category1 } =
        await testDataFactory.createMultilingualCategory(
          { sortOrder: 3 },
          { name: { ko: '세 번째 카테고리' } },
        );
      const { category: category2 } =
        await testDataFactory.createMultilingualCategory(
          { sortOrder: 1 },
          { name: { ko: '첫 번째 카테고리' } },
        );
      const { category: category3 } =
        await testDataFactory.createMultilingualCategory(
          { sortOrder: 2 },
          { name: { ko: '두 번째 카테고리' } },
        );

      // When
      const result = await categoryService.getCategory(LanguageCode.KOREAN);

      // Then - 이름으로 정렬 순서 확인 (sortOrder 필드는 DTO에 없음)
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('첫 번째 카테고리'); // sortOrder: 1
      expect(result[1].name).toBe('두 번째 카테고리'); // sortOrder: 2
      expect(result[2].name).toBe('세 번째 카테고리'); // sortOrder: 3
    });
  });

  describe('postCategory', () => {
    it('다국어 카테고리를 생성해야 합니다', async () => {
      // Given
      const languages = await testDataFactory.createDefaultLanguages();
      const dto = {
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
      await categoryService.postCategory(dto);

      // Then
      const categories = await categoryService.getCategory(LanguageCode.KOREAN);
      expect(categories).toHaveLength(1);
      expect(categories[0]).toMatchObject({
        name: '테스트 카테고리',
      });

      const enCategories = await categoryService.getCategory(
        LanguageCode.ENGLISH,
      );
      expect(enCategories[0].name).toBe('Test Category');

      const zhCategories = await categoryService.getCategory(
        LanguageCode.TAIWAN,
      );
      expect(zhCategories[0].name).toBe('测试类别');
    });

    it('sortOrder가 자동으로 증가해야 합니다', async () => {
      // Given
      const languages = await testDataFactory.createDefaultLanguages();

      const dto1 = {
        list: [
          {
            languageId: languages.korean.id,
            name: '첫 번째 카테고리',
          },
        ],
      };

      const dto2 = {
        list: [
          {
            languageId: languages.korean.id,
            name: '두 번째 카테고리',
          },
        ],
      };

      // When
      await categoryService.postCategory(dto1);
      await categoryService.postCategory(dto2);

      // Then
      const categories = await categoryService.getCategory(LanguageCode.KOREAN);
      expect(categories).toHaveLength(2);
      expect(categories[0].name).toBe('첫 번째 카테고리');
      expect(categories[1].name).toBe('두 번째 카테고리');
    });

    it('기존 카테고리가 있는 경우 올바른 sortOrder를 설정해야 합니다', async () => {
      // Given - 기존 카테고리 (다국어 텍스트 포함)
      await testDataFactory.createMultilingualCategory(
        { sortOrder: 5 },
        { name: { ko: '기존 카테고리' } },
      );
      const languages = await testDataFactory.createDefaultLanguages();

      const dto = {
        list: [
          {
            languageId: languages.korean.id,
            name: '새 카테고리',
          },
        ],
      };

      // When
      await categoryService.postCategory(dto);

      // Then - sortOrder는 DTO에 없으므로 이름으로만 확인
      const categories = await categoryService.getCategory(LanguageCode.KOREAN);
      expect(categories).toHaveLength(2);

      // sortOrder로 정렬되므로 기존 카테고리(sortOrder: 5), 새 카테고리(sortOrder: 6) 순서
      expect(categories[0].name).toBe('기존 카테고리');
      expect(categories[1].name).toBe('새 카테고리');
    });

    it('빈 리스트로 요청 시 카테고리는 생성되지만 다국어 텍스트가 없어야 합니다', async () => {
      // Given
      const dto = {
        list: [], // 빈 리스트
      };

      // When
      await categoryService.postCategory(dto);

      // Then - 카테고리는 생성되지만 다국어 텍스트가 없어서 name이 null
      const categories = await categoryService.getCategory(LanguageCode.KOREAN);
      expect(categories).toHaveLength(1);
      expect(categories[0]).toMatchObject({
        id: expect.any(Number),
        name: null, // 다국어 텍스트가 없어서 null
      });

      // 실제로는 카테고리가 DB에 생성되어 있음을 확인
      const allCategories =
        await categoryService['categoryRepositoryService'].findCategory();
      expect(allCategories).toHaveLength(1);
    });
  });
});

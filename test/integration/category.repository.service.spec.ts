import { CategoryEntity } from '@app/repository/entity/category.entity';
import { CategoryRepositoryService } from '@app/repository/service/category.repository.service';
import { Test, TestingModule } from '@nestjs/testing';

import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('CategoryRepositoryService Integration Tests', () => {
  let categoryRepositoryService: CategoryRepositoryService;
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    module = await Test.createTestingModule({
      imports: [TestDatabaseModule],
      providers: [CategoryRepositoryService],
    }).compile();

    categoryRepositoryService = module.get<CategoryRepositoryService>(
      CategoryRepositoryService,
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

  describe('findCategory', () => {
    it('sortOrder 순으로 카테고리를 조회해야 합니다', async () => {
      // Given
      await testDataFactory.createCategory({ sortOrder: 3 });
      await testDataFactory.createCategory({ sortOrder: 1 });
      await testDataFactory.createCategory({ sortOrder: 2 });

      // When
      const result = await categoryRepositoryService.findCategory();

      // Then
      expect(result).toHaveLength(3);
      expect(result[0].sortOrder).toBe(1);
      expect(result[1].sortOrder).toBe(2);
      expect(result[2].sortOrder).toBe(3);
    });
  });

  describe('insert', () => {
    it('sortOrder가 없는 경우 자동으로 1을 설정해야 합니다', async () => {
      // Given
      const category = new CategoryEntity();

      // When
      const result = await categoryRepositoryService.insert(category);

      // Then
      expect(result.sortOrder).toBe(1);
    });

    it('sortOrder가 있는 경우 그 값을 유지해야 합니다', async () => {
      // Given
      const category = new CategoryEntity();
      category.sortOrder = 5;

      // When
      const result = await categoryRepositoryService.insert(category);

      // Then
      expect(result.sortOrder).toBe(5);
    });

    it('기존 카테고리가 있는 경우 최대값 + 1로 설정해야 합니다', async () => {
      // Given
      await testDataFactory.createCategory({ sortOrder: 3 });
      await testDataFactory.createCategory({ sortOrder: 7 });
      await testDataFactory.createCategory({ sortOrder: 1 });

      const newCategory = new CategoryEntity();

      // When
      const result = await categoryRepositoryService.insert(newCategory);

      // Then
      expect(result.sortOrder).toBe(8); // 최대값 7 + 1
    });

    it('여러 카테고리를 연속으로 생성하면 순차적으로 증가해야 합니다', async () => {
      // Given
      const category1 = new CategoryEntity();
      const category2 = new CategoryEntity();
      const category3 = new CategoryEntity();

      // When
      const result1 = await categoryRepositoryService.insert(category1);
      const result2 = await categoryRepositoryService.insert(category2);
      const result3 = await categoryRepositoryService.insert(category3);

      // Then
      expect(result1.sortOrder).toBe(1);
      expect(result2.sortOrder).toBe(2);
      expect(result3.sortOrder).toBe(3);
    });

    it('기존 카테고리와 새 카테고리가 섞여있을 때 올바르게 동작해야 합니다', async () => {
      // Given
      await testDataFactory.createCategory({ sortOrder: 2 });
      await testDataFactory.createCategory({ sortOrder: 5 });

      const newCategory1 = new CategoryEntity();
      const newCategory2 = new CategoryEntity();
      newCategory2.sortOrder = 10; // 수동 설정

      // When
      const result1 = await categoryRepositoryService.insert(newCategory1);
      const result2 = await categoryRepositoryService.insert(newCategory2);
      const newCategory3 = new CategoryEntity();
      const result3 = await categoryRepositoryService.insert(newCategory3);

      // Then
      expect(result1.sortOrder).toBe(6); // 기존 최대값 5 + 1
      expect(result2.sortOrder).toBe(10); // 수동 설정값 유지
      expect(result3.sortOrder).toBe(11); // 현재 최대값 10 + 1
    });
  });

  describe('bulkInsert', () => {
    it('여러 카테고리를 일괄 저장해야 합니다', async () => {
      // Given
      const category1 = await testDataFactory.createCategoryEntity({
        sortOrder: 1,
      });
      const category2 = await testDataFactory.createCategoryEntity({
        sortOrder: 2,
      });

      // When
      const result = await categoryRepositoryService.bulkInsert([
        category1,
        category2,
      ]);

      // Then
      expect(result).toHaveLength(2);
      expect(result[0].sortOrder).toBe(1);
      expect(result[1].sortOrder).toBe(2);
    });
  });
});

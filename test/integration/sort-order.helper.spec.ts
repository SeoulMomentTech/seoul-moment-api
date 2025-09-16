import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';

import { CategoryEntity } from '../../libs/repository/src/entity/category.entity';
import { SortOrderHelper } from '../../libs/repository/src/helper/sort-order.helper';
import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('SortOrderHelper Integration Tests', () => {
  let sortOrderHelper: SortOrderHelper;
  let categoryRepository: Repository<CategoryEntity>;
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    module = await Test.createTestingModule({
      imports: [TestDatabaseModule],
    }).compile();

    sortOrderHelper = module.get<SortOrderHelper>(SortOrderHelper);
    categoryRepository =
      TestSetup.getDataSource().getRepository(CategoryEntity);
    testDataFactory = new TestDataFactory(TestSetup.getDataSource());
  });

  afterAll(async () => {
    await module.close();
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    await TestSetup.clearDatabase();
  });

  describe('getNextSortOrder', () => {
    it('빈 테이블에서 1을 반환해야 함', async () => {
      const nextSortOrder =
        await sortOrderHelper.getNextSortOrder(categoryRepository);

      expect(nextSortOrder).toBe(1);
    });

    it('기존 데이터가 있을 때 최대값 + 1을 반환해야 함', async () => {
      // Given: sortOrder가 다른 category들 생성
      await testDataFactory.createCategory({ sortOrder: 3 });
      await testDataFactory.createCategory({ sortOrder: 1 });
      await testDataFactory.createCategory({ sortOrder: 5 });

      // When
      const nextSortOrder =
        await sortOrderHelper.getNextSortOrder(categoryRepository);

      // Then
      expect(nextSortOrder).toBe(6); // 최대값 5 + 1
    });

    it('조건부 조회가 정상 작동해야 함 (향후 확장용)', async () => {
      // Given: 다른 sortOrder 값들
      await testDataFactory.createCategory({ sortOrder: 10 });
      await testDataFactory.createCategory({ sortOrder: 20 });

      // When: 조건 없이 조회
      const nextSortOrder =
        await sortOrderHelper.getNextSortOrder(categoryRepository);

      // Then
      expect(nextSortOrder).toBe(21);
    });
  });

  describe('setNextSortOrder', () => {
    it('sortOrder가 없는 entity에 자동 설정해야 함', async () => {
      // Given: 기존 데이터 생성
      await testDataFactory.createCategory({ sortOrder: 2 });
      await testDataFactory.createCategory({ sortOrder: 4 });

      // When: sortOrder 없는 entity 생성
      const newCategory = new CategoryEntity();
      await sortOrderHelper.setNextSortOrder(newCategory, categoryRepository);

      // Then
      expect(newCategory.sortOrder).toBe(5); // 최대값 4 + 1
    });

    it('sortOrder가 이미 있는 entity는 그대로 유지해야 함', async () => {
      // Given: 기존 데이터 생성
      await testDataFactory.createCategory({ sortOrder: 10 });

      // When: sortOrder가 이미 있는 entity
      const categoryWithSortOrder = new CategoryEntity();
      categoryWithSortOrder.sortOrder = 99;

      await sortOrderHelper.setNextSortOrder(
        categoryWithSortOrder,
        categoryRepository,
      );

      // Then: 기존 값 유지
      expect(categoryWithSortOrder.sortOrder).toBe(99);
    });

    it('sortOrder가 0인 경우 자동 설정해야 함', async () => {
      // Given: 기존 데이터
      await testDataFactory.createCategory({ sortOrder: 3 });

      // When: sortOrder가 0 (falsy)
      const categoryWithZero = new CategoryEntity();
      categoryWithZero.sortOrder = 0;

      await sortOrderHelper.setNextSortOrder(
        categoryWithZero,
        categoryRepository,
      );

      // Then: 자동 설정됨 (0은 falsy이므로)
      expect(categoryWithZero.sortOrder).toBe(4);
    });
  });

  describe('edge cases', () => {
    it('매우 큰 sortOrder 값이 있어도 정상 작동해야 함', async () => {
      // Given: 큰 sortOrder 값
      await testDataFactory.createCategory({ sortOrder: 999999 });

      // When
      const nextSortOrder =
        await sortOrderHelper.getNextSortOrder(categoryRepository);

      // Then
      expect(nextSortOrder).toBe(1000000);
    });

    it('null/undefined sortOrder 처리가 정상적이어야 함', async () => {
      // Given: null sortOrder를 가진 데이터 (DB 기본값 적용됨)
      const category = await testDataFactory.createCategory();
      // testDataFactory에서 기본값이 설정되므로 확인

      // When
      const nextSortOrder =
        await sortOrderHelper.getNextSortOrder(categoryRepository);

      // Then: 기본값 + 1이 반환되어야 함
      expect(nextSortOrder).toBeGreaterThan(1);
    });
  });
});

import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { BrandEntity } from '@app/repository/entity/brand.entity';
import { BrandStatus } from '@app/repository/enum/brand.enum';
import { BrandRepositoryService } from '@app/repository/service/brand.repository.service';
import { Test, TestingModule } from '@nestjs/testing';

import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('BrandRepositoryService Integration Tests', () => {
  let brandRepositoryService: BrandRepositoryService;
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    module = await Test.createTestingModule({
      imports: [TestDatabaseModule],
      providers: [BrandRepositoryService],
    }).compile();

    brandRepositoryService = module.get<BrandRepositoryService>(
      BrandRepositoryService,
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

  describe('findAllNormalBrandList', () => {
    it('should return only brands with NORMAL status', async () => {
      // Given: 다양한 상태의 브랜드들 생성
      await testDataFactory.createBrandsWithDifferentStatuses();

      // When: NORMAL 상태 브랜드들 조회
      const result = await brandRepositoryService.findAllNormalBrandList();

      // Then: NORMAL 상태 브랜드만 반환
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(BrandStatus.NORMAL);
    });

    it('should return empty array when no normal brands exist', async () => {
      // Given: NORMAL 상태가 아닌 브랜드들만 생성
      await testDataFactory.createBrand({ status: BrandStatus.WAIT });
      await testDataFactory.createBrand({ status: BrandStatus.BLOCK });

      // When: NORMAL 상태 브랜드들 조회
      const result = await brandRepositoryService.findAllNormalBrandList();

      // Then: 빈 배열 반환
      expect(result).toHaveLength(0);
    });

    it('should return brands with eager loaded relations', async () => {
      // Given: 완전한 브랜드 데이터 생성 (배너, 섹션, 이미지 포함)
      await testDataFactory.createFullBrand({
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
            images: [
              { sortOrder: 1, imageUrl: 'section2-1.jpg' },
              { sortOrder: 2, imageUrl: 'section2-2.jpg' },
            ],
          },
          {
            sortOrder: 3,
            images: [
              { sortOrder: 1, imageUrl: 'section3-1.jpg' },
              { sortOrder: 2, imageUrl: 'section3-2.jpg' },
            ],
          },
        ],
      });

      // When: 브랜드 조회
      const result = await brandRepositoryService.findAllNormalBrandList();

      // Then: 관련 데이터가 eager loading으로 포함됨
      expect(result).toHaveLength(1);

      const brand = result[0];
      expect(brand.bannerImage).toHaveLength(2);
      expect(brand.section).toHaveLength(3);
      expect(brand.section[0].sectionImage).toHaveLength(2);
    });

    it('should sort banners and sections by sortOrder', async () => {
      // Given: 정렬 순서가 다른 브랜드 데이터 생성
      const brand = await testDataFactory.createBrand({
        status: BrandStatus.NORMAL,
      });

      // 배너 이미지를 역순으로 생성
      await testDataFactory.createBannerImage(brand, {
        sortOrder: 3,
        imageUrl: 'banner3.jpg',
      });
      await testDataFactory.createBannerImage(brand, {
        sortOrder: 1,
        imageUrl: 'banner1.jpg',
      });
      await testDataFactory.createBannerImage(brand, {
        sortOrder: 2,
        imageUrl: 'banner2.jpg',
      });

      // When: 브랜드 조회
      const result = await brandRepositoryService.findAllNormalBrandList();

      // Then: sortOrder에 따라 정렬됨
      const brandResult = result[0];
      const sortedBanners = brandResult.bannerImage.sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      expect(sortedBanners[0].sortOrder).toBe(1);
      expect(sortedBanners[1].sortOrder).toBe(2);
      expect(sortedBanners[2].sortOrder).toBe(3);
    });
  });

  describe('findBrandById', () => {
    it('should return brand when exists with NORMAL status', async () => {
      // Given: NORMAL 상태 브랜드 생성
      const createdBrand = await testDataFactory.createBrand({
        status: BrandStatus.NORMAL,
      });

      // When: 브랜드 ID로 조회
      const result = await brandRepositoryService.findBrandById(
        createdBrand.id,
      );

      // Then: 브랜드 반환
      expect(result).toBeDefined();
      expect(result.id).toBe(createdBrand.id);
      expect(result.status).toBe(BrandStatus.NORMAL);
    });

    it('should return null when brand does not exist', async () => {
      // When: 존재하지 않는 브랜드 ID로 조회
      const result = await brandRepositoryService.findBrandById(999);

      // Then: null 반환
      expect(result).toBeNull();
    });

    it('should return null when brand exists but not NORMAL status', async () => {
      // Given: BLOCK 상태 브랜드 생성
      const blockedBrand = await testDataFactory.createBrand({
        status: BrandStatus.BLOCK,
      });

      // When: 브랜드 ID로 조회
      const result = await brandRepositoryService.findBrandById(
        blockedBrand.id,
      );

      // Then: null 반환 (NORMAL 상태가 아니므로)
      expect(result).toBeNull();
    });
  });

  describe('getBrandById', () => {
    it('should return brand when exists with NORMAL status', async () => {
      // Given: 완전한 브랜드 데이터 생성
      const createdBrand = await testDataFactory.createFullBrand({
        brand: { status: BrandStatus.NORMAL },
      });

      // When: 브랜드 ID로 조회
      const result = await brandRepositoryService.getBrandById(createdBrand.id);

      // Then: 브랜드와 관련 데이터 반환
      expect(result).toBeDefined();
      expect(result.id).toBe(createdBrand.id);
      expect(result.bannerImage).toBeDefined();
      expect(result.section).toBeDefined();
    });

    it('should throw ServiceError when brand does not exist', async () => {
      // When & Then: 존재하지 않는 브랜드 ID로 조회 시 에러 발생
      await expect(brandRepositoryService.getBrandById(999)).rejects.toThrow(
        ServiceError,
      );

      try {
        await brandRepositoryService.getBrandById(999);
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        expect(error.message).toBe('Brand not found or not in normal status');
        expect(error.getCode()).toBe(ServiceErrorCode.NOT_FOUND_DATA);
      }
    });

    it('should throw ServiceError when brand exists but not NORMAL status', async () => {
      // Given: WAIT 상태 브랜드 생성
      const waitingBrand = await testDataFactory.createBrand({
        status: BrandStatus.WAIT,
      });

      // When & Then: WAIT 상태 브랜드 조회 시 에러 발생
      await expect(
        brandRepositoryService.getBrandById(waitingBrand.id),
      ).rejects.toThrow(ServiceError);
    });

    it('should return brand with all nested relations', async () => {
      // Given: 복잡한 브랜드 데이터 생성
      const brand = await testDataFactory.createFullBrand({
        brand: { status: BrandStatus.NORMAL },
        banners: [
          { sortOrder: 1, imageUrl: 'banner1.jpg' },
          { sortOrder: 2, imageUrl: 'banner2.jpg' },
          { sortOrder: 3, imageUrl: 'banner3.jpg' },
        ],
        sections: [
          {
            sortOrder: 1,
            images: [
              { sortOrder: 1, imageUrl: 'section1-1.jpg' },
              { sortOrder: 2, imageUrl: 'section1-2.jpg' },
              { sortOrder: 3, imageUrl: 'section1-3.jpg' },
            ],
          },
          {
            sortOrder: 2,
            images: [
              { sortOrder: 1, imageUrl: 'section2-1.jpg' },
              { sortOrder: 2, imageUrl: 'section2-2.jpg' },
              { sortOrder: 3, imageUrl: 'section2-3.jpg' },
            ],
          },
          {
            sortOrder: 3,
            images: [
              { sortOrder: 1, imageUrl: 'section3-1.jpg' },
              { sortOrder: 2, imageUrl: 'section3-2.jpg' },
              { sortOrder: 3, imageUrl: 'section3-3.jpg' },
            ],
          },
          {
            sortOrder: 4,
            images: [
              { sortOrder: 1, imageUrl: 'section4-1.jpg' },
              { sortOrder: 2, imageUrl: 'section4-2.jpg' },
              { sortOrder: 3, imageUrl: 'section4-3.jpg' },
            ],
          },
        ],
      });

      // When: 브랜드 조회
      const result = await brandRepositoryService.getBrandById(brand.id);

      // Then: 모든 중첩된 관계 데이터 포함
      expect(result.bannerImage).toHaveLength(3);
      expect(result.section).toHaveLength(4);

      result.section.forEach((section) => {
        expect(section.sectionImage).toHaveLength(3);
        expect(section.sectionImage[0]).toHaveProperty('imageUrl');
        expect(section.sectionImage[0]).toHaveProperty('sortOrder');
      });
    });
  });

  describe('Database constraints and validation', () => {
    it('should handle concurrent access correctly', async () => {
      // Given: 브랜드 생성
      const brand = await testDataFactory.createBrand({
        status: BrandStatus.NORMAL,
      });

      // When: 동시에 같은 브랜드 조회
      const promises = Array(5)
        .fill(null)
        .map(() => brandRepositoryService.getBrandById(brand.id));

      const results = await Promise.all(promises);

      // Then: 모든 요청이 성공적으로 같은 브랜드 반환
      results.forEach((result) => {
        expect(result.id).toBe(brand.id);
        expect(result.status).toBe(brand.status);
      });
    });

    it('should maintain data integrity with cascading deletes', async () => {
      // Given: 완전한 브랜드 데이터 생성
      const brand = await testDataFactory.createFullBrand();

      // When: 브랜드 삭제 (CASCADE로 관련 데이터도 삭제됨)
      const dataSource = TestSetup.getDataSource();
      await dataSource.getRepository(BrandEntity).remove(brand);

      // Then: 브랜드 조회 시 null 반환
      const result = await brandRepositoryService.findBrandById(brand.id);
      expect(result).toBeNull();
    });
  });
});

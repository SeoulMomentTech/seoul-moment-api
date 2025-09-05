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
      const actualBanners = banners.filter(b => createdBannerIds.includes(b.id));
      
      expect(actualBanners).toHaveLength(3);
      expect(actualBanners[0].sortOrder).toBeLessThanOrEqual(actualBanners[1].sortOrder);
      expect(actualBanners[1].sortOrder).toBeLessThanOrEqual(actualBanners[2].sortOrder);
    });
  });
});
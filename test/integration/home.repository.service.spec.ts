import { HomeRepositoryService } from '@app/repository/service/home.repository.service';
import { Test, TestingModule } from '@nestjs/testing';

import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('HomeRepositoryService Integration Tests', () => {
  let homeRepositoryService: HomeRepositoryService;
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    module = await Test.createTestingModule({
      imports: [TestDatabaseModule],
      providers: [HomeRepositoryService],
    }).compile();

    homeRepositoryService = module.get<HomeRepositoryService>(
      HomeRepositoryService,
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

  describe('findHome', () => {
    it('should return empty home data when no data exists', async () => {
      const result = await homeRepositoryService.findHome();

      expect(result).toBeDefined();
      expect(result.banner).toEqual([]);
      expect(result.section).toEqual([]);
    });

    it('should return home data with banners only', async () => {
      const { banners } = await testDataFactory.createFullHome({
        banners: [
          { sortOrder: 1, imageUrl: '/banner1.jpg' },
          { sortOrder: 2, imageUrl: '/banner2.jpg' },
        ],
        sections: [],
      });

      const result = await homeRepositoryService.findHome();

      expect(result.banner).toHaveLength(2);
      expect(result.banner[0].id).toBe(banners[0].id);
      expect(result.banner[0].imageUrl).toBe('/banner1.jpg');
      expect(result.banner[0].sortOrder).toBe(1);
      expect(result.banner[1].id).toBe(banners[1].id);
      expect(result.banner[1].imageUrl).toBe('/banner2.jpg');
      expect(result.banner[1].sortOrder).toBe(2);
      expect(result.section).toEqual([]);
    });

    it('should return home data with sections only', async () => {
      const { sections } = await testDataFactory.createFullHome({
        banners: [],
        sections: [
          {
            sortOrder: 1,
            url: 'https://example.com/section1',
            urlName: 'Section 1',
          },
          {
            sortOrder: 2,
            url: 'https://example.com/section2',
            urlName: 'Section 2',
          },
        ],
      });

      const result = await homeRepositoryService.findHome();

      expect(result.banner).toEqual([]);
      expect(result.section).toHaveLength(2);
      expect(result.section[0].id).toBe(sections[0].id);
      expect(result.section[0].url).toBe('https://example.com/section1');
      expect(result.section[0].urlName).toBe('Section 1');
      expect(result.section[0].sortOrder).toBe(1);
      expect(result.section[1].id).toBe(sections[1].id);
      expect(result.section[1].url).toBe('https://example.com/section2');
      expect(result.section[1].urlName).toBe('Section 2');
      expect(result.section[1].sortOrder).toBe(2);
    });

    it('should return complete home data with banners and sections', async () => {
      const { banners, sections } = await testDataFactory.createFullHome({
        banners: [
          { sortOrder: 1, imageUrl: '/banner1.jpg' },
          { sortOrder: 3, imageUrl: '/banner3.jpg' },
        ],
        sections: [
          {
            sortOrder: 2,
            url: 'https://example.com/section2',
            urlName: 'Section 2',
          },
          {
            sortOrder: 1,
            url: 'https://example.com/section1',
            urlName: 'Section 1',
          },
        ],
      });

      const result = await homeRepositoryService.findHome();

      expect(result.banner).toHaveLength(2);
      expect(result.section).toHaveLength(2);

      // 배너는 sortOrder로 정렬되어야 함 (ASC)
      expect(result.banner[0].sortOrder).toBe(1);
      expect(result.banner[1].sortOrder).toBe(3);

      // 섹션도 sortOrder로 정렬되어야 함 (ASC)
      expect(result.section[0].sortOrder).toBe(1);
      expect(result.section[1].sortOrder).toBe(2);
    });

    it('should return sections with section images when they exist', async () => {
      const { sections } = await testDataFactory.createFullHome({
        banners: [],
        sections: [
          {
            sortOrder: 1,
            url: 'https://example.com/section1',
            urlName: 'Section 1',
            images: [
              { sortOrder: 1, imageUrl: '/section1-image1.jpg' },
              { sortOrder: 2, imageUrl: '/section1-image2.jpg' },
            ],
          },
        ],
      });

      const result = await homeRepositoryService.findHome();

      expect(result.section).toHaveLength(1);
      expect(result.section[0].sectionImage).toHaveLength(2);

      // sectionImage는 eager loading으로 자동 로드되지만 정렬은 보장되지 않음
      const sortedImages = result.section[0].sectionImage.sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      expect(sortedImages[0].imageUrl).toBe('/section1-image1.jpg');
      expect(sortedImages[0].sortOrder).toBe(1);
      expect(sortedImages[1].imageUrl).toBe('/section1-image2.jpg');
      expect(sortedImages[1].sortOrder).toBe(2);
    });

    it('should handle mixed data with proper sorting', async () => {
      // 순서를 섞어서 생성하여 정렬 테스트
      await testDataFactory.createFullHome({
        banners: [
          { sortOrder: 3, imageUrl: '/banner3.jpg' },
          { sortOrder: 1, imageUrl: '/banner1.jpg' },
          { sortOrder: 2, imageUrl: '/banner2.jpg' },
        ],
        sections: [
          {
            sortOrder: 3,
            url: 'https://example.com/section3',
            urlName: 'Section 3',
          },
          {
            sortOrder: 1,
            url: 'https://example.com/section1',
            urlName: 'Section 1',
          },
          {
            sortOrder: 2,
            url: 'https://example.com/section2',
            urlName: 'Section 2',
          },
        ],
      });

      const result = await homeRepositoryService.findHome();

      // 배너 정렬 확인
      expect(result.banner).toHaveLength(3);
      expect(result.banner[0].sortOrder).toBe(1);
      expect(result.banner[0].imageUrl).toBe('/banner1.jpg');
      expect(result.banner[1].sortOrder).toBe(2);
      expect(result.banner[1].imageUrl).toBe('/banner2.jpg');
      expect(result.banner[2].sortOrder).toBe(3);
      expect(result.banner[2].imageUrl).toBe('/banner3.jpg');

      // 섹션 정렬 확인
      expect(result.section).toHaveLength(3);
      expect(result.section[0].sortOrder).toBe(1);
      expect(result.section[0].urlName).toBe('Section 1');
      expect(result.section[1].sortOrder).toBe(2);
      expect(result.section[1].urlName).toBe('Section 2');
      expect(result.section[2].sortOrder).toBe(3);
      expect(result.section[2].urlName).toBe('Section 3');
    });
  });
});

import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Configuration } from '@app/config/configuration';
import { BrandStatus } from '@app/repository/enum/brand.enum';
import { Test, TestingModule } from '@nestjs/testing';

import { GetBrandIntroduceResponse } from '../../apps/api/src/module/brand/brand.dto';
import { BrandModule } from '../../apps/api/src/module/brand/brand.module';
import { BrandService } from '../../apps/api/src/module/brand/brand.service';
import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('BrandService Integration Tests', () => {
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

  describe('getBrandIntroduce', () => {
    it('should return brand introduce response with actual DB data', async () => {
      // Given: 실제 DB에 완전한 브랜드 데이터 생성
      const createdBrand = await testDataFactory.createFullBrand({
        brand: {
          name: 'Seoul Moment',
          description: '서울의 특별한 순간들을 담은 브랜드',
          status: BrandStatus.NORMAL,
        },
        bannerCount: 3,
        sectionCount: 2,
        imagesPerSection: 2,
      });

      // When: 실제 서비스 메서드 호출
      const result = await brandService.getBrandIntroduce(createdBrand.id);

      // Then: DB에서 가져온 실제 데이터 검증
      expect(result).toBeInstanceOf(GetBrandIntroduceResponse);
      expect(result.id).toBe(createdBrand.id);
      expect(result.name).toBe('Seoul Moment');
      expect(result.description).toBe('서울의 특별한 순간들을 담은 브랜드');
      expect(result.bannerList).toHaveLength(3);
      expect(result.section).toHaveLength(2);

      // 배너 이미지 URL 검증
      result.bannerList.forEach((bannerUrl) => {
        expect(bannerUrl).toMatch(/^https:\/\/.*banner.*\.jpg$/);
      });

      // 섹션 데이터 검증
      result.section.forEach((section) => {
        expect(section.title).toBeDefined();
        expect(section.content).toBeDefined();
        expect(section.imageList).toHaveLength(2);
        section.imageList.forEach((imageUrl) => {
          expect(imageUrl).toMatch(/^https:\/\/.*\.jpg$/);
        });
      });
    });

    it('should throw ServiceError when brand does not exist in DB', async () => {
      // When & Then: 존재하지 않는 브랜드 ID로 조회 시 에러 발생
      await expect(brandService.getBrandIntroduce(999)).rejects.toThrow(
        ServiceError,
      );

      try {
        await brandService.getBrandIntroduce(999);
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        expect(error.message).toBe('Brand not found or not in normal status');
        expect(error.getCode()).toBe(ServiceErrorCode.NOT_FOUND_DATA);
      }
    });

    it('should throw ServiceError when brand exists but not NORMAL status', async () => {
      // Given: BLOCK 상태의 브랜드 생성
      const blockedBrand = await testDataFactory.createBrand({
        name: 'Blocked Brand',
        status: BrandStatus.BLOCK,
      });

      // When & Then: BLOCK 상태 브랜드 조회 시 에러 발생
      await expect(
        brandService.getBrandIntroduce(blockedBrand.id),
      ).rejects.toThrow(ServiceError);

      try {
        await brandService.getBrandIntroduce(blockedBrand.id);
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        expect(error.getCode()).toBe(ServiceErrorCode.NOT_FOUND_DATA);
      }
    });

    it('should handle brand with no banners or sections', async () => {
      // Given: 배너와 섹션이 없는 최소한의 브랜드 생성
      const minimalBrand = await testDataFactory.createBrand({
        name: 'Minimal Brand',
        description: 'Simple brand without banners or sections',
        status: BrandStatus.NORMAL,
      });

      // When: 서비스 메서드 호출
      const result = await brandService.getBrandIntroduce(minimalBrand.id);

      // Then: 빈 배열들이 정상적으로 반환됨
      expect(result.id).toBe(minimalBrand.id);
      expect(result.name).toBe('Minimal Brand');
      expect(result.description).toBe(
        'Simple brand without banners or sections',
      );
      expect(result.bannerList).toEqual([]);
      expect(result.section).toEqual([]);
    });

    it('should return correctly sorted banners and sections', async () => {
      // Given: 정렬 순서가 다른 브랜드 데이터 생성
      const brand = await testDataFactory.createBrand({
        name: 'Sorted Brand',
        status: BrandStatus.NORMAL,
      });

      // 배너를 역순으로 생성
      await testDataFactory.createBannerImage(brand, {
        sortOrder: 3,
        imageUrl: '/banner3.jpg',
        altText: 'Banner 3',
      });
      await testDataFactory.createBannerImage(brand, {
        sortOrder: 1,
        imageUrl: '/banner1.jpg',
        altText: 'Banner 1',
      });
      await testDataFactory.createBannerImage(brand, {
        sortOrder: 2,
        imageUrl: '/banner2.jpg',
        altText: 'Banner 2',
      });

      // 섹션을 역순으로 생성
      await testDataFactory.createBrandSection(brand, {
        title: 'Section 2',
        content: 'Second section',
        sortOrder: 2,
      });
      const section1 = await testDataFactory.createBrandSection(brand, {
        title: 'Section 1',
        content: 'First section',
        sortOrder: 1,
      });

      // 섹션 이미지도 역순으로 생성
      await testDataFactory.createSectionImage(section1, {
        sortOrder: 2,
        imageUrl: '/section1-2.jpg',
      });
      await testDataFactory.createSectionImage(section1, {
        sortOrder: 1,
        imageUrl: '/section1-1.jpg',
      });

      // When: 서비스 메서드 호출
      const result = await brandService.getBrandIntroduce(brand.id);

      // Then: 정렬된 순서로 반환됨
      expect(result.bannerList).toEqual([
        `${Configuration.getConfig().IMAGE_DOMAIN_NAME}/banner1.jpg`,
        `${Configuration.getConfig().IMAGE_DOMAIN_NAME}/banner2.jpg`,
        `${Configuration.getConfig().IMAGE_DOMAIN_NAME}/banner3.jpg`,
      ]);

      expect(result.section).toHaveLength(2);
      expect(result.section[0].title).toBe('Section 1');
      expect(result.section[1].title).toBe('Section 2');

      expect(result.section[0].imageList).toEqual([
        `${Configuration.getConfig().IMAGE_DOMAIN_NAME}/section1-1.jpg`,
        `${Configuration.getConfig().IMAGE_DOMAIN_NAME}/section1-2.jpg`,
      ]);
    });

    it('should handle complex brand with multiple sections and images', async () => {
      // Given: 복잡한 브랜드 구조 생성
      const complexBrand = await testDataFactory.createBrand({
        name: 'Complex Brand',
        description: 'Brand with multiple sections',
        status: BrandStatus.NORMAL,
      });

      // 여러 배너 생성
      for (let i = 1; i <= 5; i++) {
        await testDataFactory.createBannerImage(complexBrand, {
          sortOrder: i,
          imageUrl: `/banner${i}.jpg`,
          altText: `Banner ${i}`,
        });
      }

      // 여러 섹션과 각 섹션마다 여러 이미지 생성
      for (let sectionIndex = 1; sectionIndex <= 3; sectionIndex++) {
        const section = await testDataFactory.createBrandSection(complexBrand, {
          title: `Section ${sectionIndex}`,
          content: `Content for section ${sectionIndex}`,
          sortOrder: sectionIndex,
        });

        for (let imgIndex = 1; imgIndex <= 4; imgIndex++) {
          await testDataFactory.createSectionImage(section, {
            sortOrder: imgIndex,
            imageUrl: `/section${sectionIndex}-${imgIndex}.jpg`,
            altText: `Section ${sectionIndex} Image ${imgIndex}`,
          });
        }
      }

      // When: 서비스 메서드 호출
      const result = await brandService.getBrandIntroduce(complexBrand.id);

      // Then: 모든 데이터가 정확히 반환됨
      expect(result.bannerList).toHaveLength(5);
      expect(result.section).toHaveLength(3);

      result.section.forEach((section, index) => {
        expect(section.title).toBe(`Section ${index + 1}`);
        expect(section.content).toBe(`Content for section ${index + 1}`);
        expect(section.imageList).toHaveLength(4);

        section.imageList.forEach((imageUrl, imgIndex) => {
          expect(imageUrl).toBe(
            `${Configuration.getConfig().IMAGE_DOMAIN_NAME}/section${index + 1}-${imgIndex + 1}.jpg`,
          );
        });
      });
    });

    it('should maintain data consistency across multiple calls', async () => {
      // Given: 브랜드 데이터 생성
      const brand = await testDataFactory.createFullBrand({
        brand: {
          name: 'Consistent Brand',
          status: BrandStatus.NORMAL,
        },
        bannerCount: 2,
        sectionCount: 2,
        imagesPerSection: 1,
      });

      // When: 같은 브랜드를 여러 번 조회
      const results = await Promise.all([
        brandService.getBrandIntroduce(brand.id),
        brandService.getBrandIntroduce(brand.id),
        brandService.getBrandIntroduce(brand.id),
      ]);

      // Then: 모든 결과가 동일함
      results.forEach((result) => {
        expect(result.id).toBe(brand.id);
        expect(result.name).toBe('Consistent Brand');
        expect(result.bannerList).toHaveLength(2);
        expect(result.section).toHaveLength(2);
      });

      // 결과들이 서로 완전히 동일한지 확인
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);
    });
  });
});

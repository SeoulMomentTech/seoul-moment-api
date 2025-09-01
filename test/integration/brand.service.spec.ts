import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { BrandStatus } from '@app/repository/enum/brand.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
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

  describe('getBrandIntroduce (Backward Compatibility)', () => {
    it('should return empty strings for brand without multilingual content', async () => {
      // Given: 다국어 콘텐츠가 없는 브랜드 생성
      const createdBrand = await testDataFactory.createFullBrand({
        brand: { status: BrandStatus.NORMAL },
        banners: [
          { sortOrder: 1, imageUrl: 'banner1.jpg' },
          { sortOrder: 2, imageUrl: 'banner2.jpg' },
        ],
        sections: [
          {
            sortOrder: 1,
            images: [{ sortOrder: 1, imageUrl: 'section1.jpg' }],
          },
        ],
      });

      // When: 서비스 메서드 호출 (기본 언어: 한국어)
      const result = await brandService.getBrandIntroduce(createdBrand.id);

      // Then: 구조는 유지되지만 텍스트 필드는 빈 문자열
      expect(result).toBeInstanceOf(GetBrandIntroduceResponse);
      expect(result.id).toBe(createdBrand.id);
      expect(result.name).toBe(''); // 다국어 콘텐츠 없음
      expect(result.description).toBe(''); // 다국어 콘텐츠 없음
      expect(result.bannerList).toHaveLength(2);
      expect(result.section).toHaveLength(1);
      expect(result.section[0].title).toBe(''); // 다국어 콘텐츠 없음
      expect(result.section[0].content).toBe(''); // 다국어 콘텐츠 없음
      expect(result.section[0].imageList).toHaveLength(1);
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
        status: BrandStatus.NORMAL,
      });

      // When: 서비스 메서드 호출
      const result = await brandService.getBrandIntroduce(minimalBrand.id);

      // Then: 빈 배열들이 정상적으로 반환됨
      expect(result.id).toBe(minimalBrand.id);
      expect(result.name).toBe(''); // 다국어 콘텐츠 없음
      expect(result.description).toBe(''); // 다국어 콘텐츠 없음
      expect(result.bannerList).toEqual([]);
      expect(result.section).toEqual([]);
    });

    it('should work with multilingual content', async () => {
      // Given: 다국어 브랜드 생성
      const { brand, languages } =
        await testDataFactory.createMultilingualBrand(
          { status: BrandStatus.NORMAL },
          {
            name: {
              [LanguageCode.KOREAN]: '서울모먼트',
              [LanguageCode.ENGLISH]: 'Seoul Moment',
            },
            description: {
              [LanguageCode.KOREAN]: '서울의 특별한 순간들',
              [LanguageCode.ENGLISH]: 'Special moments of Seoul',
            },
          },
        );

      // When: 한국어로 조회
      const koreanResult = await brandService.getBrandIntroduce(
        brand.id,
        LanguageCode.KOREAN,
      );

      // Then: 한국어 콘텐츠 반환
      expect(koreanResult.name).toBe('서울모먼트');
      expect(koreanResult.description).toBe('서울의 특별한 순간들');

      // When: 영어로 조회
      const englishResult = await brandService.getBrandIntroduce(
        brand.id,
        LanguageCode.ENGLISH,
      );

      // Then: 영어 콘텐츠 반환
      expect(englishResult.name).toBe('Seoul Moment');
      expect(englishResult.description).toBe('Special moments of Seoul');
    });
  });
});

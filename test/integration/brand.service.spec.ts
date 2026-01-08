import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { BrandNameFilter, BrandStatus } from '@app/repository/enum/brand.enum';
import { EntityType } from '@app/repository/enum/entity.enum';
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

    it('should return brand name List', async () => {
      const brand = await testDataFactory.createBrand();
      await testDataFactory.createLanguage({
        code: LanguageCode.ENGLISH,
        englishName: 'english',
        name: '영어',
      });
      const languageENtity = await testDataFactory.createLanguage({
        code: LanguageCode.ENGLISH,
        englishName: 'english',
        name: '영어',
      });

      await testDataFactory.createMultilingualText(
        EntityType.BRAND,
        brand.id,
        'name',
        languageENtity,
        'abc',
      );

      const response = await brandService.getBrandListByNameFilterType(
        BrandNameFilter.A_TO_D,
      );

      expect(response[0].id).toBe(1);
      expect(response[0].name).toBe('abc');
    });

    it('if use categoryId, should return brand name List', async () => {
      const brand = await testDataFactory.createBrand();
      await testDataFactory.createLanguage({
        code: LanguageCode.ENGLISH,
        englishName: 'english',
        name: '영어',
      });
      const languageENtity = await testDataFactory.createLanguage({
        code: LanguageCode.ENGLISH,
        englishName: 'english',
        name: '영어',
      });

      await testDataFactory.createMultilingualText(
        EntityType.BRAND,
        brand.id,
        'name',
        languageENtity,
        'abc',
      );

      const response = await brandService.getBrandListByNameFilterType(
        BrandNameFilter.A_TO_D,
        1,
      );

      expect(response[0].id).toBe(1);
      expect(response[0].name).toBe('abc');
    });

    it('brand 등록시 getBrand 로 data 를 가져와야 한다.', async () => {
      // Given: 기본 언어들과 카테고리 생성
      await testDataFactory.languageFactory.createLanguages();
      const category = await testDataFactory.categoryFactory.createCategory();

      const dto = testDataFactory.brandFactory.getPostBrandDto(3);
      dto.categoryId = category.id;

      // When: 브랜드 등록
      await brandService.postBrand(dto);

      // Then: 등록된 브랜드를 getBrandIntroduce로 조회 시 정상 데이터 반환
      const brand = await brandService.getBrandIntroduce(
        1,
        LanguageCode.KOREAN,
      );

      // 기본 브랜드 정보 검증
      expect(brand).toBeInstanceOf(GetBrandIntroduceResponse);
      expect(brand.id).toBe(1);
      expect(brand.name).toBe('테스트 브랜드');
      expect(brand.description).toBe('테스트 브랜드 설명입니다.');

      // 배너 이미지 검증
      expect(brand.bannerList).toHaveLength(2);
      expect(brand.bannerList).toEqual([
        'https://image-dev.seoulmoment.com.tw/brand-banners/2025-09-16/test-banner-01.jpg',
        'https://image-dev.seoulmoment.com.tw/brand-banners/2025-09-16/test-banner-02.jpg',
      ]);

      // 섹션 데이터 검증 (3개 섹션)
      expect(brand.section).toHaveLength(3);

      // 첫 번째 섹션 (브랜드 스토리)
      expect(brand.section[0].title).toBe('브랜드 스토리');
      expect(brand.section[0].content).toBe('테스트 브랜드의 스토리입니다.');
      expect(brand.section[0].imageList).toHaveLength(2);
      expect(brand.section[0].imageList).toEqual([
        'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/test-section-01.jpg',
        'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/test-section-02.jpg',
      ]);

      // 두 번째 섹션 (브랜드 연혁)
      expect(brand.section[1].title).toBe('브랜드 연혁');
      expect(brand.section[1].content).toBe('테스트 브랜드의 발전 과정입니다.');
      expect(brand.section[1].imageList).toHaveLength(2);
      expect(brand.section[1].imageList).toEqual([
        'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/test-history-01.jpg',
        'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/test-history-02.jpg',
      ]);

      // 세 번째 섹션 (브랜드 철학)
      expect(brand.section[2].title).toBe('브랜드 철학');
      expect(brand.section[2].content).toBe(
        '테스트 브랜드의 핵심 가치와 철학입니다.',
      );
      expect(brand.section[2].imageList).toHaveLength(2);
      expect(brand.section[2].imageList).toEqual([
        'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/test-philosophy-01.jpg',
        'https://image-dev.seoulmoment.com.tw/brand-sections/2025-09-16/test-philosophy-02.jpg',
      ]);

      // 영어 조회도 검증
      const englishBrand = await brandService.getBrandIntroduce(
        1,
        LanguageCode.ENGLISH,
      );

      expect(englishBrand.name).toBe('Test Brand');
      expect(englishBrand.description).toBe(
        'This is a test brand description.',
      );
      expect(englishBrand.section[0].title).toBe('Brand Story');
      expect(englishBrand.section[0].content).toBe(
        'This is the test brand story.',
      );
    });
  });
});

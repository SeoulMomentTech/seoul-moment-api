import { PartnerRepositoryService } from '@app/repository/service/partner.repository.service';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { Test, TestingModule } from '@nestjs/testing';

import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('PartnerRepositoryService Integration Tests', () => {
  let partnerRepositoryService: PartnerRepositoryService;
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    module = await Test.createTestingModule({
      imports: [TestDatabaseModule],
      providers: [PartnerRepositoryService],
    }).compile();

    partnerRepositoryService = module.get<PartnerRepositoryService>(PartnerRepositoryService);
    testDataFactory = new TestDataFactory(TestSetup.getDataSource());
  });

  afterAll(async () => {
    await module.close();
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    await TestSetup.clearDatabase();
  });

  describe('find', () => {
    it('should return all partners', async () => {
      // Given
      const partnerCategory = await testDataFactory.createPartnerCategory();
      const partner1 = await testDataFactory.createPartner({
        partnerCategoryId: partnerCategory.id,
        country: LanguageCode.KOREAN,
      });
      const partner2 = await testDataFactory.createPartner({
        partnerCategoryId: partnerCategory.id,
        country: LanguageCode.ENGLISH,
      });

      // When
      const result = await partnerRepositoryService.find();

      // Then
      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: partner1.id }),
          expect.objectContaining({ id: partner2.id }),
        ]),
      );
    });

    it('should return empty array when no partners exist', async () => {
      // When
      const result = await partnerRepositoryService.find();

      // Then
      expect(result).toHaveLength(0);
    });
  });

  describe('findByCategoryIdAndCountry', () => {
    it('should return partners filtered by category and country', async () => {
      // Given
      const partnerCategory1 = await testDataFactory.createPartnerCategory();
      const partnerCategory2 = await testDataFactory.createPartnerCategory();
      
      const koreanPartner1 = await testDataFactory.createPartner({
        partnerCategoryId: partnerCategory1.id,
        country: LanguageCode.KOREAN,
      });
      const koreanPartner2 = await testDataFactory.createPartner({
        partnerCategoryId: partnerCategory1.id,
        country: LanguageCode.KOREAN,
      });
      const englishPartner = await testDataFactory.createPartner({
        partnerCategoryId: partnerCategory1.id,
        country: LanguageCode.ENGLISH,
      });
      const otherCategoryPartner = await testDataFactory.createPartner({
        partnerCategoryId: partnerCategory2.id,
        country: LanguageCode.KOREAN,
      });

      // When
      const result = await partnerRepositoryService.findByCategoryIdAndCountry(
        partnerCategory1.id,
        LanguageCode.KOREAN,
      );

      // Then
      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ 
            id: koreanPartner1.id,
            partnerCategoryId: partnerCategory1.id,
            country: LanguageCode.KOREAN,
          }),
          expect.objectContaining({ 
            id: koreanPartner2.id,
            partnerCategoryId: partnerCategory1.id,
            country: LanguageCode.KOREAN,
          }),
        ]),
      );
      expect(result).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: englishPartner.id }),
          expect.objectContaining({ id: otherCategoryPartner.id }),
        ]),
      );
    });

    it('should return empty array when no matching partners exist', async () => {
      // Given
      const partnerCategory = await testDataFactory.createPartnerCategory();
      await testDataFactory.createPartner({
        partnerCategoryId: partnerCategory.id,
        country: LanguageCode.KOREAN,
      });

      // When
      const result = await partnerRepositoryService.findByCategoryIdAndCountry(
        partnerCategory.id,
        LanguageCode.ENGLISH,
      );

      // Then
      expect(result).toHaveLength(0);
    });

    it('should return empty array when category does not exist', async () => {
      // When
      const result = await partnerRepositoryService.findByCategoryIdAndCountry(
        999,
        LanguageCode.KOREAN,
      );

      // Then
      expect(result).toHaveLength(0);
    });
  });
});
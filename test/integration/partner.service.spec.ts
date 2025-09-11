import { LanguageCode } from '@app/repository/enum/language.enum';
import { LanguageRepositoryService } from '@app/repository/service/language.repository.service';
import { PartnerRepositoryService } from '@app/repository/service/partner.repository.service';
import { Test, TestingModule } from '@nestjs/testing';

import { PartnerService } from '../../apps/api/src/module/partner/partner.service';
import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('PartnerService Integration Tests', () => {
  let partnerService: PartnerService;
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    module = await Test.createTestingModule({
      imports: [TestDatabaseModule],
      providers: [
        PartnerService,
        PartnerRepositoryService,
        LanguageRepositoryService,
      ],
    }).compile();

    partnerService = module.get<PartnerService>(PartnerService);
    testDataFactory = new TestDataFactory(TestSetup.getDataSource());
  });

  afterAll(async () => {
    await module.close();
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    await TestSetup.clearDatabase();
  });

  describe('getPartner', () => {
    it('should return partners with multilingual text in Korean', async () => {
      // Given
      const { partner, partnerCategory } =
        await testDataFactory.createMultilingualPartner(
          { country: LanguageCode.KOREAN },
          {
            title: {
              [LanguageCode.KOREAN]: '한국 협력사',
              [LanguageCode.ENGLISH]: 'Korean Partner',
              [LanguageCode.CHINESE]: '韩国合作伙伴',
            },
            description: {
              [LanguageCode.KOREAN]: '한국 협력사 설명',
              [LanguageCode.ENGLISH]: 'Korean Partner Description',
              [LanguageCode.CHINESE]: '韩国合作伙伴描述',
            },
          },
        );

      // When
      const result = await partnerService.getPartner(
        partnerCategory.id,
        LanguageCode.KOREAN,
        LanguageCode.KOREAN,
      );

      // Then
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: partner.id,
        title: '한국 협력사',
        description: '한국 협력사 설명',
        country: LanguageCode.KOREAN,
        image: expect.stringContaining(partner.image),
        link: partner.link,
      });
    });

    it('should return partners with multilingual text in English', async () => {
      // Given
      const { partner, partnerCategory } =
        await testDataFactory.createMultilingualPartner(
          { country: LanguageCode.KOREAN },
          {
            title: {
              [LanguageCode.KOREAN]: '한국 협력사',
              [LanguageCode.ENGLISH]: 'Korean Partner',
              [LanguageCode.CHINESE]: '韩国合作伙伴',
            },
            description: {
              [LanguageCode.KOREAN]: '한국 협력사 설명',
              [LanguageCode.ENGLISH]: 'Korean Partner Description',
              [LanguageCode.CHINESE]: '韩国合作伙伴描述',
            },
          },
        );

      // When
      const result = await partnerService.getPartner(
        partnerCategory.id,
        LanguageCode.KOREAN,
        LanguageCode.ENGLISH,
      );

      // Then
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: partner.id,
        title: 'Korean Partner',
        description: 'Korean Partner Description',
        country: LanguageCode.KOREAN,
        image: expect.stringContaining(partner.image),
        link: partner.link,
      });
    });

    it('should return partners with multilingual text in Chinese', async () => {
      // Given
      const { partner, partnerCategory } =
        await testDataFactory.createMultilingualPartner(
          { country: LanguageCode.KOREAN },
          {
            title: {
              [LanguageCode.KOREAN]: '한국 협력사',
              [LanguageCode.ENGLISH]: 'Korean Partner',
              [LanguageCode.CHINESE]: '韩国合作伙伴',
            },
            description: {
              [LanguageCode.KOREAN]: '한국 협력사 설명',
              [LanguageCode.ENGLISH]: 'Korean Partner Description',
              [LanguageCode.CHINESE]: '韩国合作伙伴描述',
            },
          },
        );

      // When
      const result = await partnerService.getPartner(
        partnerCategory.id,
        LanguageCode.KOREAN,
        LanguageCode.CHINESE,
      );

      // Then
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: partner.id,
        title: '韩国合作伙伴',
        description: '韩国合作伙伴描述',
        country: LanguageCode.KOREAN,
        image: expect.stringContaining(partner.image),
        link: partner.link,
      });
    });

    it('should return multiple partners for the same category and country', async () => {
      // Given
      const partnerCategory = await testDataFactory.createPartnerCategory();

      const { partner: partner1 } =
        await testDataFactory.createMultilingualPartner(
          {
            partnerCategoryId: partnerCategory.id,
            country: LanguageCode.KOREAN,
          },
          {
            title: {
              [LanguageCode.KOREAN]: '첫 번째 협력사',
              [LanguageCode.ENGLISH]: 'First Partner',
            },
          },
        );

      const { partner: partner2 } =
        await testDataFactory.createMultilingualPartner(
          {
            partnerCategoryId: partnerCategory.id,
            country: LanguageCode.KOREAN,
          },
          {
            title: {
              [LanguageCode.KOREAN]: '두 번째 협력사',
              [LanguageCode.ENGLISH]: 'Second Partner',
            },
          },
        );

      // When
      const result = await partnerService.getPartner(
        partnerCategory.id,
        LanguageCode.KOREAN,
        LanguageCode.KOREAN,
      );

      // Then
      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: partner1.id,
            title: '첫 번째 협력사',
          }),
          expect.objectContaining({
            id: partner2.id,
            title: '두 번째 협력사',
          }),
        ]),
      );
    });

    it('should return empty array when no partners match criteria', async () => {
      // Given
      const partnerCategory = await testDataFactory.createPartnerCategory();
      await testDataFactory.createMultilingualPartner({
        partnerCategoryId: partnerCategory.id,
        country: LanguageCode.KOREAN,
      });

      // When
      const result = await partnerService.getPartner(
        partnerCategory.id,
        LanguageCode.ENGLISH, // Different country
        LanguageCode.KOREAN,
      );

      // Then
      expect(result).toHaveLength(0);
    });

    it('should return empty array when category does not exist', async () => {
      // When
      const result = await partnerService.getPartner(
        999, // Non-existent category
        LanguageCode.KOREAN,
        LanguageCode.KOREAN,
      );

      // Then
      expect(result).toHaveLength(0);
    });

    it('should handle partners without multilingual text gracefully', async () => {
      // Given
      const partnerCategory = await testDataFactory.createPartnerCategory();
      const partner = await testDataFactory.createPartner({
        partnerCategoryId: partnerCategory.id,
        country: LanguageCode.KOREAN,
      });

      // When
      const result = await partnerService.getPartner(
        partnerCategory.id,
        LanguageCode.KOREAN,
        LanguageCode.KOREAN,
      );

      // Then
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: partner.id,
        title: null, // Empty when no multilingual text exists
        description: null,
        country: LanguageCode.KOREAN,
        image: expect.stringContaining(partner.image),
        link: partner.link,
      });
    });
  });
});

import { PartnerCategoryEntity } from '@app/repository/entity/partner-category.entity';
import { PartnerEntity } from '@app/repository/entity/partner.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { DataSource } from 'typeorm';

import { LanguageFactory } from './language.factory';

export class PartnerFactory {
  constructor(private readonly dataSource: DataSource) {}

  async createPartnerCategory(
    overrides: Partial<PartnerCategoryEntity> = {},
  ): Promise<PartnerCategoryEntity> {
    const repository = this.dataSource.getRepository(PartnerCategoryEntity);

    const partnerCategory = repository.create({
      sortOrder: 1,
      ...overrides,
    });

    return repository.save(partnerCategory);
  }

  async createPartner(
    overrides: Partial<PartnerEntity> = {},
  ): Promise<PartnerEntity> {
    const repository = this.dataSource.getRepository(PartnerEntity);

    // PartnerCategory가 없으면 생성
    let partnerCategoryId = overrides.partnerCategoryId;
    if (!partnerCategoryId) {
      const partnerCategory = await this.createPartnerCategory();
      partnerCategoryId = partnerCategory.id;
    }

    const partner = repository.create({
      partnerCategoryId,
      country: LanguageCode.KOREAN,
      image: '/test/partner/test-partner.jpg',
      link: 'https://test-partner.com',
      ...overrides,
    });

    return repository.save(partner);
  }

  async createMultilingualPartnerCategory(
    overrides: Partial<PartnerCategoryEntity> = {},
    multilingualData: {
      name?: Partial<Record<LanguageCode, string>>;
    } = {},
  ): Promise<{
    partnerCategory: PartnerCategoryEntity;
    languages: any[];
    texts: any[];
  }> {
    const languageFactory = new LanguageFactory(this.dataSource);

    // 1. 기본 언어 데이터 준비
    const defaultMultilingualData = {
      name: {
        [LanguageCode.KOREAN]: '테스트 협력사 카테고리',
        [LanguageCode.ENGLISH]: 'Test Partner Category',
        [LanguageCode.TAIWAN]: '测试合作伙伴类别',
      },
      ...multilingualData,
    };

    // 2. 언어 엔티티들 생성
    const languages = await languageFactory.createLanguages();

    // 3. 협력사 카테고리 생성
    const partnerCategory = await this.createPartnerCategory(overrides);

    // 4. 다국어 텍스트 생성
    const texts = [];
    for (const language of languages) {
      if (
        defaultMultilingualData.name &&
        defaultMultilingualData.name[language.code]
      ) {
        const nameText = await languageFactory.createMultilingualText(
          EntityType.PARTNER_CATEGORY,
          partnerCategory.id,
          'name',
          language,
          defaultMultilingualData.name[language.code],
        );
        texts.push(nameText);
      }
    }

    return {
      partnerCategory,
      languages,
      texts,
    };
  }

  async createMultilingualPartner(
    overrides: Partial<PartnerEntity> = {},
    multilingualData: {
      title?: Partial<Record<LanguageCode, string>>;
      description?: Partial<Record<LanguageCode, string>>;
    } = {},
  ): Promise<{
    partner: PartnerEntity;
    partnerCategory: PartnerCategoryEntity;
    languages: any[];
    texts: any[];
  }> {
    const languageFactory = new LanguageFactory(this.dataSource);

    // 1. 기본 언어 데이터 준비
    const defaultMultilingualData = {
      title: {
        [LanguageCode.KOREAN]: '테스트 협력사',
        [LanguageCode.ENGLISH]: 'Test Partner',
        [LanguageCode.TAIWAN]: '测试合作伙伴',
      },
      description: {
        [LanguageCode.KOREAN]: '테스트 협력사 설명',
        [LanguageCode.ENGLISH]: 'Test Partner Description',
        [LanguageCode.TAIWAN]: '测试合作伙伴描述',
      },
      ...multilingualData,
    };

    // 2. 언어 엔티티들 생성
    const languages = await languageFactory.createLanguages();

    // 3. 협력사 카테고리 생성 (필요한 경우)
    let partnerCategory: PartnerCategoryEntity;
    if (overrides.partnerCategoryId) {
      partnerCategory = await this.dataSource
        .getRepository(PartnerCategoryEntity)
        .findOne({ where: { id: overrides.partnerCategoryId } });
    }

    if (!partnerCategory) {
      partnerCategory = await this.createPartnerCategory();
      overrides.partnerCategoryId = partnerCategory.id;
    }

    // 4. 협력사 생성
    const partner = await this.createPartner(overrides);

    // 5. 다국어 텍스트 생성
    const texts = [];
    for (const language of languages) {
      if (
        defaultMultilingualData.title &&
        defaultMultilingualData.title[language.code]
      ) {
        const titleText = await languageFactory.createMultilingualText(
          EntityType.PARTNER,
          partner.id,
          'title',
          language,
          defaultMultilingualData.title[language.code],
        );
        texts.push(titleText);
      }

      if (
        defaultMultilingualData.description &&
        defaultMultilingualData.description[language.code]
      ) {
        const descriptionText = await languageFactory.createMultilingualText(
          EntityType.PARTNER,
          partner.id,
          'description',
          language,
          defaultMultilingualData.description[language.code],
        );
        texts.push(descriptionText);
      }
    }

    return {
      partner,
      partnerCategory,
      languages,
      texts,
    };
  }
}

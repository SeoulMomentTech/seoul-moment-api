import { CategoryEntity } from '@app/repository/entity/category.entity';
import { LanguageEntity } from '@app/repository/entity/language.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { SortOrderHelper } from '@app/repository/helper/sort-order.helper';
import { DataSource } from 'typeorm';

import { LanguageFactory } from './language.factory';

export class CategoryFactory {
  private languageFactory: LanguageFactory;
  private sortOrderHelper: SortOrderHelper;

  constructor(private dataSource: DataSource) {
    this.languageFactory = new LanguageFactory(dataSource);
    this.sortOrderHelper = new SortOrderHelper();
  }

  /**
   * 카테고리 생성
   */
  async createCategory(
    overrides: Partial<CategoryEntity> = {},
  ): Promise<CategoryEntity> {
    const categoryRepository = this.dataSource.getRepository(CategoryEntity);

    const category = categoryRepository.create({
      ...overrides,
    });

    // SortOrderHelper를 사용하여 sortOrder 설정
    await this.sortOrderHelper.setNextSortOrder(category, categoryRepository);

    return categoryRepository.save(category);
  }

  /**
   * 카테고리 엔티티 인스턴스만 생성 (저장하지 않음)
   */
  createCategoryEntity(
    overrides: Partial<CategoryEntity> = {},
  ): CategoryEntity {
    const categoryRepository = this.dataSource.getRepository(CategoryEntity);

    return categoryRepository.create({
      ...overrides,
    });
  }

  /**
   * 다국어 카테고리 생성
   */
  async createMultilingualCategory(
    categoryData: Partial<CategoryEntity> = {},
    multilingualData?: {
      name?: { [key in LanguageCode]?: string };
    },
  ): Promise<{
    category: CategoryEntity;
    languages: {
      korean: LanguageEntity;
      english: LanguageEntity;
      chinese: LanguageEntity;
    };
    texts: MultilingualTextEntity[];
  }> {
    // 카테고리 생성
    const category = await this.createCategory(categoryData);

    // 언어 생성
    const languages = await this.languageFactory.createDefaultLanguages();

    // 다국어 텍스트 생성
    const texts: MultilingualTextEntity[] = [];

    if (multilingualData?.name) {
      for (const [langCode, content] of Object.entries(multilingualData.name)) {
        const language = Object.values(languages).find(
          (l) => l.code === langCode,
        );
        if (language && content) {
          const text = await this.languageFactory.createMultilingualText(
            EntityType.CATEGORY,
            category.id,
            'name',
            language,
            content,
          );
          texts.push(text);
        }
      }
    }

    return { category, languages, texts };
  }
}

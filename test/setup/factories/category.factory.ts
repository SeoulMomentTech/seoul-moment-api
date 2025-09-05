import { CategoryEntity } from '@app/repository/entity/category.entity';
import { LanguageEntity } from '@app/repository/entity/language.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { DataSource } from 'typeorm';

import { LanguageFactory } from './language.factory';

export class CategoryFactory {
  private languageFactory: LanguageFactory;

  constructor(private dataSource: DataSource) {
    this.languageFactory = new LanguageFactory(dataSource);
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

    return categoryRepository.save(category);
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

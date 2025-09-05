import { LanguageEntity } from '@app/repository/entity/language.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { EntityType } from '@app/repository/enum/entity.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { DataSource } from 'typeorm';

export class LanguageFactory {
  constructor(private dataSource: DataSource) {}

  /**
   * 언어 생성
   */
  async createLanguage(
    overrides: Partial<LanguageEntity> = {},
  ): Promise<LanguageEntity> {
    const languageRepository = this.dataSource.getRepository(LanguageEntity);

    const language = languageRepository.create({
      code: LanguageCode.KOREAN,
      name: '한국어',
      englishName: 'Korean',
      isActive: true,
      sortOrder: 1,
      ...overrides,
    });

    return languageRepository.save(language);
  }

  /**
   * 다국어 텍스트 생성
   */
  async createMultilingualText(
    entityType: EntityType,
    entityId: number,
    fieldName: string,
    language: LanguageEntity,
    textContent: string,
    overrides: Partial<MultilingualTextEntity> = {},
  ): Promise<MultilingualTextEntity> {
    const textRepository = this.dataSource.getRepository(
      MultilingualTextEntity,
    );

    const text = textRepository.create({
      entityType,
      entityId,
      fieldName,
      languageId: language.id,
      textContent,
      ...overrides,
    });

    return textRepository.save(text);
  }

  /**
   * 기본 언어들 생성 (한국어, 영어, 중국어)
   */
  async createDefaultLanguages(): Promise<{
    korean: LanguageEntity;
    english: LanguageEntity;
    chinese: LanguageEntity;
  }> {
    const korean = await this.createLanguage({
      code: LanguageCode.KOREAN,
      name: '한국어',
      englishName: 'Korean',
      sortOrder: 1,
    });

    const english = await this.createLanguage({
      code: LanguageCode.ENGLISH,
      name: 'English',
      englishName: 'English',
      sortOrder: 2,
    });

    const chinese = await this.createLanguage({
      code: LanguageCode.CHINESE,
      name: '中文',
      englishName: 'Chinese',
      sortOrder: 3,
    });

    return { korean, english, chinese };
  }
}

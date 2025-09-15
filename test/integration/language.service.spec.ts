import { LanguageCode } from '@app/repository/enum/language.enum';
import { Test, TestingModule } from '@nestjs/testing';

import { LanguageModule } from '../../apps/api/src/module/language/language.module';
import { LanguageService } from '../../apps/api/src/module/language/language.service';
import { TestDataFactory } from '../setup/test-data.factory';
import { TestDatabaseModule } from '../setup/test-database.module';
import { TestSetup } from '../setup/test-setup';

describe('LanguageService Integration Tests', () => {
  let languageService: LanguageService;
  let testDataFactory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestSetup.initialize();

    module = await Test.createTestingModule({
      imports: [TestDatabaseModule, LanguageModule],
    }).compile();

    languageService = module.get<LanguageService>(LanguageService);
    testDataFactory = new TestDataFactory(TestSetup.getDataSource());
  });

  afterAll(async () => {
    await module.close();
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    await TestSetup.clearDatabase();
  });

  describe('getAvaliableLanguage', () => {
    it('빈 언어 목록을 반환해야 합니다', async () => {
      // When
      const result = await languageService.getAvaliableLanguage();

      // Then
      expect(result).toEqual([]);
    });

    it('활성 언어 목록을 반환해야 합니다', async () => {
      // Given
      const languages = await testDataFactory.createDefaultLanguages();

      // When
      const result = await languageService.getAvaliableLanguage();

      // Then
      expect(result).toHaveLength(3);

      const languageNames = result.map((lang) => lang.name);
      expect(languageNames).toContain('한국어');
      expect(languageNames).toContain('English');
      expect(languageNames).toContain('中文');

      const languageCodes = result.map((lang) => lang.code);
      expect(languageCodes).toContain('ko');
      expect(languageCodes).toContain('en');
      expect(languageCodes).toContain('zh');
    });

    it('sortOrder 순으로 언어를 반환해야 합니다', async () => {
      // Given
      await testDataFactory.createLanguage({
        name: '첫 번째 언어',
        code: LanguageCode.KOREAN,
        sortOrder: 1,
        isActive: true,
      });

      await testDataFactory.createLanguage({
        name: '세 번째 언어',
        code: LanguageCode.ENGLISH,
        sortOrder: 3,
        isActive: true,
      });

      await testDataFactory.createLanguage({
        name: '두 번째 언어',
        code: LanguageCode.CHINESE,
        sortOrder: 2,
        isActive: true,
      });

      // When
      const result = await languageService.getAvaliableLanguage();

      // Then
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('첫 번째 언어');
      expect(result[0].sortOrder).toBe(1);
      expect(result[1].name).toBe('두 번째 언어');
      expect(result[1].sortOrder).toBe(2);
      expect(result[2].name).toBe('세 번째 언어');
      expect(result[2].sortOrder).toBe(3);
    });

    it('비활성 언어는 반환하지 않아야 합니다', async () => {
      // Given
      await testDataFactory.createLanguage({
        name: '활성 언어',
        code: LanguageCode.KOREAN,
        sortOrder: 1,
        isActive: true,
      });

      await testDataFactory.createLanguage({
        name: '비활성 언어',
        code: LanguageCode.ENGLISH,
        sortOrder: 2,
        isActive: false,
      });

      // When
      const result = await languageService.getAvaliableLanguage();

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('활성 언어');
      expect(result[0]).not.toHaveProperty('isActive'); // DTO에는 isActive 포함하지 않음
    });

    it('올바른 DTO 형태로 반환해야 합니다', async () => {
      // Given
      const language = await testDataFactory.createLanguage({
        name: '테스트 언어',
        code: LanguageCode.KOREAN,
        sortOrder: 1,
        isActive: true,
      });

      // When
      const result = await languageService.getAvaliableLanguage();

      // Then
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: language.id,
        name: '테스트 언어',
        code: LanguageCode.KOREAN,
        sortOrder: 1,
      });

      // DTO에 포함되지 않아야 하는 필드들
      expect(result[0]).not.toHaveProperty('isActive');
      expect(result[0]).not.toHaveProperty('createdAt');
      expect(result[0]).not.toHaveProperty('updatedAt');
    });

    it('다양한 언어 코드를 올바르게 처리해야 합니다', async () => {
      // Given
      await testDataFactory.createLanguage({
        name: 'Japanese',
        code: LanguageCode.KOREAN,
        sortOrder: 1,
        isActive: true,
      });

      await testDataFactory.createLanguage({
        name: 'Français',
        code: LanguageCode.ENGLISH,
        sortOrder: 2,
        isActive: true,
      });

      // When
      const result = await languageService.getAvaliableLanguage();

      // Then
      expect(result).toHaveLength(2);
      expect(result[0].code).toBe(LanguageCode.KOREAN);
      expect(result[1].code).toBe(LanguageCode.ENGLISH);
    });

    it('대량의 언어 데이터를 올바르게 처리해야 합니다', async () => {
      // Given
      const languageCount = 3;
      const codes = [
        LanguageCode.KOREAN,
        LanguageCode.ENGLISH,
        LanguageCode.CHINESE,
      ];
      for (let i = 1; i <= languageCount; i++) {
        await testDataFactory.createLanguage({
          name: `언어 ${i}`,
          code: codes[i - 1],
          sortOrder: i,
          isActive: true,
        });
      }

      // When
      const result = await languageService.getAvaliableLanguage();

      // Then
      expect(result).toHaveLength(languageCount);
      expect(result[0].name).toBe('언어 1');
      expect(result[2].name).toBe('언어 3');

      // sortOrder가 올바르게 적용되었는지 확인
      for (let i = 0; i < languageCount; i++) {
        expect(result[i].sortOrder).toBe(i + 1);
      }
    });
  });
});

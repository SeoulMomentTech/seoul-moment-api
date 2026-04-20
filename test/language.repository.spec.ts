import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { getAdminToken } from './setup/auth.helper';
import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { EntityType } from '../libs/repository/src/enum/entity.enum';
import { LanguageCode } from '../libs/repository/src/enum/language.enum';
import { LanguageRepositoryService } from '../libs/repository/src/service/language.repository.service';

describe('LanguageRepositoryService.findMultilingualTexts* (Phase 2 projection)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let service: LanguageRepositoryService;

  beforeAll(async () => {
    // Given - 앱 싱글톤과 서비스 주입
    app = await getTestApp();
    dataSource = getDataSource(app);
    await getAdminToken(app);

    service = app.get(LanguageRepositoryService);

    // Given - 언어 시드 확인
    const languages = await dataSource.query(`SELECT id FROM language LIMIT 1`);
    if (languages.length === 0) {
      await dataSource.query(
        `INSERT INTO language (code, name, english_name, is_active, sort_order)
         VALUES ('ko', '한국어', 'Korean', true, 1),
                ('en', 'English', 'English', true, 2),
                ('zh-TW', '中文', 'Taiwan', true, 3)`,
      );
    }
  }, 60_000);

  afterEach(async () => {
    await truncateTables(dataSource, ['multilingual_text']);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // -----------------------------------------------------------------------
  // findMultilingualTexts
  // -----------------------------------------------------------------------
  describe('findMultilingualTexts', () => {
    it('반환된 엔티티가 language.code를 포함한다', async () => {
      // Given - 한국어 multilingual 저장
      await service.saveMultilingualTextByLanguageCode(
        EntityType.BRAND,
        1,
        'name',
        LanguageCode.KOREAN,
        '브랜드명',
      );

      // When
      const result = await service.findMultilingualTexts(EntityType.BRAND, 1);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].textContent).toBe('브랜드명');
      expect(result[0].language).toBeDefined();
      expect(result[0].language.code).toBe(LanguageCode.KOREAN);
    });

    it('languageCode 지정 시 해당 언어만 반환한다', async () => {
      // Given - 3개 언어 저장
      await service.saveMultilingualTextByLanguageCode(
        EntityType.BRAND,
        1,
        'name',
        LanguageCode.KOREAN,
        '한국어',
      );
      await service.saveMultilingualTextByLanguageCode(
        EntityType.BRAND,
        1,
        'name',
        LanguageCode.ENGLISH,
        'English',
      );
      await service.saveMultilingualTextByLanguageCode(
        EntityType.BRAND,
        1,
        'name',
        LanguageCode.TAIWAN,
        '繁體',
      );

      // When
      const result = await service.findMultilingualTexts(
        EntityType.BRAND,
        1,
        LanguageCode.ENGLISH,
      );

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].language.code).toBe(LanguageCode.ENGLISH);
      expect(result[0].textContent).toBe('English');
    });

    it('fieldName 지정 시 해당 필드만 반환한다', async () => {
      // Given
      await service.saveMultilingualTextByLanguageCode(
        EntityType.BRAND,
        1,
        'name',
        LanguageCode.KOREAN,
        '브랜드명',
      );
      await service.saveMultilingualTextByLanguageCode(
        EntityType.BRAND,
        1,
        'description',
        LanguageCode.KOREAN,
        '설명',
      );

      // When
      const result = await service.findMultilingualTexts(
        EntityType.BRAND,
        1,
        undefined,
        'name',
      );

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].fieldName).toBe('name');
      expect(result[0].textContent).toBe('브랜드명');
    });

    it('언어별 정렬은 language.sortOrder를 기준으로 한다 (ko → en → zh-TW)', async () => {
      // Given - 역순 저장 (zh → en → ko)
      await service.saveMultilingualTextByLanguageCode(
        EntityType.BRAND,
        1,
        'name',
        LanguageCode.TAIWAN,
        '繁體',
      );
      await service.saveMultilingualTextByLanguageCode(
        EntityType.BRAND,
        1,
        'name',
        LanguageCode.ENGLISH,
        'English',
      );
      await service.saveMultilingualTextByLanguageCode(
        EntityType.BRAND,
        1,
        'name',
        LanguageCode.KOREAN,
        '한국어',
      );

      // When
      const result = await service.findMultilingualTexts(EntityType.BRAND, 1);

      // Then - sortOrder 1, 2, 3 순서로 반환
      expect(result.map((r) => r.language.code)).toEqual([
        LanguageCode.KOREAN,
        LanguageCode.ENGLISH,
        LanguageCode.TAIWAN,
      ]);
    });

    it('존재하지 않는 entityId는 빈 배열을 반환한다', async () => {
      // When
      const result = await service.findMultilingualTexts(
        EntityType.BRAND,
        999_999,
      );

      // Then
      expect(result).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // findMultilingualTextsByEntities
  // -----------------------------------------------------------------------
  describe('findMultilingualTextsByEntities', () => {
    it('여러 entityId를 IN 조회하고 각 항목에 language.code가 포함된다', async () => {
      // Given - 2개 brand에 각각 한국어 name 저장
      await service.saveMultilingualTextByLanguageCode(
        EntityType.BRAND,
        10,
        'name',
        LanguageCode.KOREAN,
        '브랜드A',
      );
      await service.saveMultilingualTextByLanguageCode(
        EntityType.BRAND,
        20,
        'name',
        LanguageCode.KOREAN,
        '브랜드B',
      );

      // When
      const result = await service.findMultilingualTextsByEntities(
        EntityType.BRAND,
        [10, 20],
        LanguageCode.KOREAN,
      );

      // Then
      expect(result).toHaveLength(2);
      const contents = result
        .map((r) => r.textContent)
        .sort((a, b) => a.localeCompare(b));
      expect(contents).toEqual(['브랜드A', '브랜드B']);
      result.forEach((r) => {
        expect(r.language.code).toBe(LanguageCode.KOREAN);
      });
    });

    it('entityIds 배열이 비어있으면 빈 배열을 반환한다', async () => {
      // When
      const result = await service.findMultilingualTextsByEntities(
        EntityType.BRAND,
        [],
      );

      // Then
      expect(result).toEqual([]);
    });

    it('languageCode 없이 호출하면 모든 언어가 반환된다', async () => {
      // Given
      await service.saveMultilingualTextByLanguageCode(
        EntityType.BRAND,
        10,
        'name',
        LanguageCode.KOREAN,
        '한국',
      );
      await service.saveMultilingualTextByLanguageCode(
        EntityType.BRAND,
        10,
        'name',
        LanguageCode.ENGLISH,
        'EN',
      );

      // When
      const result = await service.findMultilingualTextsByEntities(
        EntityType.BRAND,
        [10],
      );

      // Then
      expect(result).toHaveLength(2);
      const codes = result.map((r) => r.language.code).sort();
      expect(codes).toEqual([LanguageCode.ENGLISH, LanguageCode.KOREAN].sort());
    });

    it('다른 entityType의 데이터는 조회되지 않는다', async () => {
      // Given
      await service.saveMultilingualTextByLanguageCode(
        EntityType.BRAND,
        10,
        'name',
        LanguageCode.KOREAN,
        '브랜드',
      );
      await service.saveMultilingualTextByLanguageCode(
        EntityType.NEWS,
        10,
        'title',
        LanguageCode.KOREAN,
        '뉴스',
      );

      // When
      const result = await service.findMultilingualTextsByEntities(
        EntityType.BRAND,
        [10],
      );

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].textContent).toBe('브랜드');
      expect(result[0].entityType).toBe(EntityType.BRAND);
    });
  });
});

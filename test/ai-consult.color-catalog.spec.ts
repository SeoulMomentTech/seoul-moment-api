import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import {
  AiConsultColorCatalogDto,
  AiConsultColorSource,
  OPTION_VALUE_NAME_FIELD,
} from '../apps/api/src/module/ai-consult/ai-consult.dto';
import { AiConsultNameMatchType } from '../libs/repository/src/enum/ai-consult.enum';
import { EntityType } from '../libs/repository/src/enum/entity.enum';
import { LanguageCode } from '../libs/repository/src/enum/language.enum';
import { COLOR_OPTION_TYPE } from '../libs/repository/src/enum/option.enum';
import { LanguageRepositoryService } from '../libs/repository/src/service/language.repository.service';
import { OptionRepositoryService } from '../libs/repository/src/service/option.repository.service';

/**
 * "빨강 옷" 을 처리하려면 먼저 "빨강" 이라는 자유 텍스트가 option_value_id 로
 * 바뀌어야 한다. 이 스펙은 그 해석 계층만 실제 DB 로 검증한다.
 */
describe('AI 상담 색상 해석 (통합)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let optionRepositoryService: OptionRepositoryService;
  let languageRepositoryService: LanguageRepositoryService;

  beforeAll(async () => {
    app = await getTestApp();
    dataSource = getDataSource(app);
    optionRepositoryService = app.get(OptionRepositoryService);
    languageRepositoryService = app.get(LanguageRepositoryService);

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
    await truncateTables(dataSource, [
      'variant_option',
      'option_value',
      'option',
      'multilingual_text',
    ]);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  /** 색상 옵션 1개와 그 값들을 한/영 이름과 함께 시드한다. */
  async function seedColors(
    seeds: [ko: string, en: string, code: string | null][],
  ): Promise<Map<string, number>> {
    const optionRows = await dataSource.query(
      `INSERT INTO option (type, ui_type, sort_order, is_active)
       VALUES ($1, 'GRID', 1, true) RETURNING id`,
      [COLOR_OPTION_TYPE],
    );
    const idByKo = new Map<string, number>();

    for (const [index, [ko, en, code]] of seeds.entries()) {
      const valueRows = await dataSource.query(
        `INSERT INTO option_value (option_id, color_code, sort_order, is_active)
         VALUES ($1, $2, $3, true) RETURNING id`,
        [optionRows[0].id, code, index + 1],
      );
      const valueId = valueRows[0].id;

      for (const [language, content] of [
        [LanguageCode.KOREAN, ko],
        [LanguageCode.ENGLISH, en],
      ] as [LanguageCode, string][]) {
        await languageRepositoryService.saveMultilingualTextByLanguageCode(
          EntityType.OPTION_VALUE,
          valueId,
          OPTION_VALUE_NAME_FIELD,
          language,
          content,
        );
      }

      idByKo.set(ko, valueId);
    }

    return idByKo;
  }

  async function buildCatalog(
    language = LanguageCode.KOREAN,
  ): Promise<AiConsultColorCatalogDto> {
    const entityList = await optionRepositoryService.findColorOptionValues();
    const sources: AiConsultColorSource[] = entityList.map((entity) => ({
      id: entity.id,
      code: entity.colorCode ?? null,
    }));
    const textList =
      await languageRepositoryService.findMultilingualTextsByEntities(
        EntityType.OPTION_VALUE,
        sources.map((source) => source.id),
      );

    return AiConsultColorCatalogDto.from(sources, textList, language);
  }

  const COLORS: [string, string, string | null][] = [
    ['빨강', 'Red', '#FF0000'],
    ['파랑', 'Blue', '#0000FF'],
    ['검정', 'Black', '#000000'],
    ['하양', 'White', '#FFFFFF'],
  ];

  it('색상 옵션값을 이름·색상코드와 함께 카탈로그로 읽는다', async () => {
    // Given
    await seedColors(COLORS);

    // When
    const catalog = await buildCatalog();

    // Then - sortOrder 순서대로 한국어 이름과 코드가 나온다
    expect(catalog.getCount()).toBe(4);
    expect(catalog.getItems().map((v) => v.name)).toEqual([
      '빨강',
      '파랑',
      '검정',
      '하양',
    ]);
    expect(catalog.getItems()[0].code).toBe('#FF0000');
  });

  it('"빨강"을 option_value_id 로 해석한다', async () => {
    // Given
    const idByKo = await seedColors(COLORS);

    // When
    const match = (await buildCatalog()).findMatch('빨강');

    // Then
    expect(match.getId()).toBe(idByKo.get('빨강'));
    expect(match.toLogMeta().type).toBe(AiConsultNameMatchType.EXACT);
  });

  it('"빨간색"처럼 수식이 붙어도 부분일치로 흡수한다', async () => {
    // Given
    const idByKo = await seedColors(COLORS);

    // When - 모델이 고객 표현을 그대로 옮겼을 때
    const match = (await buildCatalog()).findMatch('빨강색');

    // Then
    expect(match.getId()).toBe(idByKo.get('빨강'));
    expect(match.toLogMeta().type).toBe(AiConsultNameMatchType.PARTIAL);
  });

  it('영문 이름으로도 잡히고 노출 이름은 요청 언어를 따른다', async () => {
    // Given
    const idByKo = await seedColors(COLORS);

    // When - Accept-Language 가 en 이어도 색인은 모든 언어로 만들어져 있다
    const catalog = await buildCatalog(LanguageCode.ENGLISH);
    const match = catalog.findMatch('Red');

    // Then
    expect(match.getId()).toBe(idByKo.get('빨강'));
    expect(catalog.findItem(match.getId()).name).toBe('Red');
  });

  it('없는 색상은 억지로 고르지 않고 점수를 남긴다', async () => {
    // Given
    await seedColors(COLORS);

    // When
    const match = (await buildCatalog()).findMatch('형광연두');

    // Then - 실패해도 1위 점수가 남아 임계값 조정 근거가 된다
    expect(match.getId()).toBeNull();
    expect(match.toLogMeta().type).toBe(AiConsultNameMatchType.BELOW_THRESHOLD);
    expect(match.toLogMeta().score).toBeLessThan(0.7);
  });

  it('색상 옵션이 아닌 옵션값은 카탈로그에 섞이지 않는다', async () => {
    // Given - 사이즈 옵션을 함께 넣는다
    await seedColors(COLORS);
    const sizeOption = await dataSource.query(
      `INSERT INTO option (type, ui_type, sort_order, is_active)
       VALUES ('SIZE', 'RADIO', 2, true) RETURNING id`,
    );
    const sizeValue = await dataSource.query(
      `INSERT INTO option_value (option_id, sort_order, is_active)
       VALUES ($1, 1, true) RETURNING id`,
      [sizeOption[0].id],
    );
    await languageRepositoryService.saveMultilingualTextByLanguageCode(
      EntityType.OPTION_VALUE,
      sizeValue[0].id,
      OPTION_VALUE_NAME_FIELD,
      LanguageCode.KOREAN,
      '라지',
    );

    // When
    const catalog = await buildCatalog();

    // Then - 사이즈는 색상 질의 후보가 되면 안 된다
    expect(catalog.getCount()).toBe(4);
    expect(catalog.findMatch('라지').getId()).toBeNull();
  });

  it('비활성 색상은 제외한다', async () => {
    // Given
    const idByKo = await seedColors(COLORS);
    await dataSource.query(
      `UPDATE option_value SET is_active = false WHERE id = $1`,
      [idByKo.get('파랑')],
    );

    // When
    const catalog = await buildCatalog();

    // Then
    expect(catalog.getCount()).toBe(3);
    expect(catalog.findMatch('파랑').getId()).toBeNull();
  });
});

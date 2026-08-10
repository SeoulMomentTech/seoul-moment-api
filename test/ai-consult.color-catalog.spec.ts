import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { parseHexToLab } from '../apps/api/src/module/ai-consult/ai-consult.color';
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

  /**
   * 운영 DB 의 실제 색상 구성.
   *
   * 이름 매칭만으로는 "빨강"(고객 어휘)과 "레드"(DB 어휘)가 자모 유사도 0.167 이라
   * 절대 못 붙는다. 운영 로그에서 상품 검색 실패의 대부분이 이것이었으므로,
   * 임계값을 건드릴 때 무엇이 깨지는지 이 픽스처가 바로 보여주도록 실제 값을 박아둔다.
   */
  describe('색공간 거리로 붙이기 (운영 색상 구성)', () => {
    const REAL_COLORS: [string, string, string | null][] = [
      ['블랙', 'Black', '#000000'],
      ['화이트', 'White', '#FFFFFF'],
      ['그레이', 'Gray', '#808080'],
      ['카키', 'Khaki', '#C3B091'],
      ['민트', 'Mint', '#c0ffee'],
      ['아이보리', 'Ivory', '#FFFFF0'],
      ['베이지', 'Beige', '#F5F5DC'],
      ['오트밀', 'Oatmeal', '#E6D8C3'],
      ['네이비', 'Navy', '#000080'],
      ['차콜', 'Charcoal', '#36454F'],
      ['라이트 퍼플', 'Light Purple', '#C8A2C8'],
      ['소라', 'Sora', '#A7C7E7'],
      ['핑크', 'Pink', '#FFC0CB'],
      ['브라운', 'Brown', '#8B4513'],
      ['레드', 'Red', '#FF0000'],
      ['라이트 블루', 'Light Blue', '#ADD8E6'],
      ['사파이어 블루', 'Sapphire Blue', '#0F52BA'],
      ['리드 그레이', 'Lead Gray', '#4A443F'],
      ['주니퍼', 'Juniper', '#282C24'],
      ['버건디', 'Burgundy', '#800020'],
      ['옐로우', 'Yellow', '#FFD400'],
      ['세이지 그린', 'Sage Green', '#A8B2A1'],
      ['네온 옐로우', 'Neon Yellow', '#DFFF00'],
      ['스카이 블루', 'Sky Blue', '#87CEEB'],
      ['모카무스', 'Mocha Mousse', '#A47864'],
    ];

    /** 매칭된 id 전부를 한국어 이름으로 되돌린다. 단언을 읽기 쉽게 하려는 용도다. */
    function namesOf(
      catalog: AiConsultColorCatalogDto,
      query: string,
    ): string[] {
      return catalog
        .findMatch(query)
        .getIds()
        .map((id) => catalog.findItem(id).name);
    }

    it('"빨강"을 DB 의 "레드"로 붙인다 (이름 매칭으로는 불가능하다)', async () => {
      // Given
      const idByKo = await seedColors(REAL_COLORS);
      const catalog = await buildCatalog();

      // When - 고객 어휘와 DB 어휘가 다르다
      const match = catalog.findMatch('빨강');

      // Then
      expect(match.getId()).toBe(idByKo.get('레드'));
      expect(match.toLogMeta().type).toBe(AiConsultNameMatchType.HEX_NEAREST);
      // 기준 hex 가 정확히 일치하므로 거리가 0 이다
      expect(match.toLogMeta().deltaE).toBe(0);
    });

    it('같은 계열 색이 여럿이면 전부 건다', async () => {
      // Given
      await seedColors(REAL_COLORS);
      const catalog = await buildCatalog();

      // When - "하늘색 옷"에 스카이 블루만 주면 재고가 없는 것처럼 보인다
      const names = namesOf(catalog, '하늘색');

      // Then - 가까운 순으로 함께 나온다
      expect(names).toContain('스카이 블루');
      expect(names).toContain('라이트 블루');
      expect(names[0]).toBe('스카이 블루');
      expect(catalog.findMatch('하늘색').toLogMeta().matchedCount).toBe(
        names.length,
      );
    });

    it('무채색 게이트: "파랑"에 차콜·그레이 같은 무채색을 주지 않는다', async () => {
      // Given
      await seedColors(REAL_COLORS);
      const catalog = await buildCatalog();

      // When - 거리만 재면 차콜이 1위로 올라온다
      const names = namesOf(catalog, '파랑');

      // Then
      expect(names).toContain('네이비');
      expect(names).not.toContain('차콜');
      expect(names).not.toContain('그레이');
      expect(names).not.toContain('리드 그레이');
    });

    it('Hue 게이트: "보라"에 네이비를 주지 않는다', async () => {
      // Given
      await seedColors(REAL_COLORS);
      const catalog = await buildCatalog();

      // When - 명도·채도가 비슷해 거리만으로는 네이비가 1위다
      const names = namesOf(catalog, '보라');

      // Then - 색상환에서 떨어져 있으므로 걸러지고 라이트 퍼플만 남는다
      expect(names).toEqual(['라이트 퍼플']);
    });

    it('취급하지 않는 색은 억지로 붙이지 않는다', async () => {
      // Given - 순수 초록 계열 상품이 없는 구성이다
      await seedColors(REAL_COLORS);
      const catalog = await buildCatalog();

      // When
      const match = catalog.findMatch('초록');

      // Then - 엉뚱한 색을 보여주느니 못 붙였다고 남긴다
      expect(match.getId()).toBeNull();
      expect(match.getIds()).toEqual([]);
    });

    it('DB 이름을 그대로 쓰면 이름 매칭이 우선한다', async () => {
      // Given
      const idByKo = await seedColors(REAL_COLORS);
      const catalog = await buildCatalog();

      // When - "레드"는 색인에 있으므로 색공간까지 갈 이유가 없다
      const match = catalog.findMatch('레드');

      // Then
      expect(match.getId()).toBe(idByKo.get('레드'));
      expect(match.toLogMeta().type).toBe(AiConsultNameMatchType.EXACT);
      expect(match.getIds()).toHaveLength(1);
    });

    it('DB 고유 이름의 오타는 여전히 자모 유사도로 구제한다', async () => {
      // Given
      const idByKo = await seedColors(REAL_COLORS);
      const catalog = await buildCatalog();

      // When - 보편 색이름이 아니라 색공간 경로가 발동하지 않는 오타다
      // (이름을 통째로 품고 있으면 부분일치로 잡히므로 가운데 글자를 틀린다)
      const match = catalog.findMatch('버간디');

      // Then - 색공간을 앞에 둬도 자모 구제가 사라지면 안 된다
      expect(match.getId()).toBe(idByKo.get('버건디'));
      expect(match.toLogMeta().type).toBe(AiConsultNameMatchType.SIMILARITY);
    });

    it('color_code 가 없는 색상은 색공간 후보에서 빠진다', async () => {
      // Given - 레드에서 hex 를 지운다
      await seedColors(REAL_COLORS);
      await dataSource.query(
        `UPDATE option_value SET color_code = NULL
          WHERE id IN (
            SELECT entity_id FROM multilingual_text
             WHERE entity_type = $1 AND field_name = $2 AND text_content = '레드'
          )`,
        [EntityType.OPTION_VALUE, OPTION_VALUE_NAME_FIELD],
      );
      const catalog = await buildCatalog();

      // When
      const names = namesOf(catalog, '빨강');

      // Then - 비교할 색이 없으므로 붉은 계열 중 남은 것만 걸린다
      expect(names).not.toContain('레드');
      // 이름으로 물으면 여전히 잡힌다 — 색인은 hex 와 무관하다
      expect(catalog.findMatch('레드').getId()).not.toBeNull();
    });

    it('소문자 hex 도 대소문자를 가리지 않고 읽는다', async () => {
      // Given - 운영 데이터에 소문자 코드(민트 #c0ffee)가 섞여 있다
      const idByKo = await seedColors(REAL_COLORS);
      const catalog = await buildCatalog();

      // When
      const mint = catalog.findItem(idByKo.get('민트'));

      // Then - 파싱에 실패하면 그 색은 색공간 매칭에서 조용히 빠진다
      expect(mint.code).toBe('#c0ffee');
      expect(parseHexToLab(mint.code)).not.toBeNull();
      expect(parseHexToLab('#C0FFEE')).toEqual(parseHexToLab('#c0ffee'));
    });
  });
});

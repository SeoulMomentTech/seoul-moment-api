import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import {
  normalizeHexCode,
  parseHexToLab,
} from '../apps/api/src/module/ai-consult/ai-consult.color';
import {
  AiConsultColorCatalogDto,
  AiConsultColorSource,
  AiConsultNameMatchDto,
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

    /**
     * 모델이 colorHex 로 내주는 값.
     *
     * 표에서 옮겨온 상수가 아니라 **실제 gemini-3.1-flash-lite 로 측정한 출력**이다
     * (temperature 0, 3라운드 전부 동일). 색 이름을 표준 색으로 옮기는 일은 이제
     * 모델이 하므로, 이 스펙은 "모델이 이 값을 줬을 때 어느 DB 색에 붙는가"를 본다.
     */
    const MODEL_HEX: Readonly<Record<string, string>> = {
      빨강: '#FF0000',
      빨강색: '#FF0000',
      빨간색: '#FF0000',
      빨강색상: '#FF0000',
      진한빨강: '#FF0000',
      아주진한빨간색: '#FF0000',
      레드: '#FF0000',
      파랑: '#0000FF',
      파랑색: '#0000FF',
      파란색: '#0000FF',
      하늘색: '#87CEEB',
      소라색: '#87CEEB',
      남색: '#000080',
      보라: '#800080',
      초록: '#008000',
      갈색: '#8B4513',
      카키: '#BDB76B',
      라이트퍼플: '#C8A2C8',
      토마토: '#FF6347',
    };

    /** 모델이 그 말을 모르면 colorHex 는 빈 문자열로 온다 → 색공간 단계를 건너뛴다. */
    function hexOf(query: string): string | null {
      return MODEL_HEX[query] ?? null;
    }

    /** 매칭된 id 전부를 한국어 이름으로 되돌린다. 단언을 읽기 쉽게 하려는 용도다. */
    function namesOf(
      catalog: AiConsultColorCatalogDto,
      query: string,
      hex: string | null = hexOf(query),
    ): string[] {
      return catalog
        .findMatch(query, hex)
        .getIds()
        .map((id) => catalog.findItem(id).name);
    }

    /** findMatch 를 모델 출력과 함께 부른다. 스펙 전체가 이 형태를 쓴다. */
    function matchOf(
      catalog: AiConsultColorCatalogDto,
      query: string,
      hex: string | null = hexOf(query),
    ): AiConsultNameMatchDto {
      return catalog.findMatch(query, hex);
    }

    it('"빨강"을 DB 의 "레드"로 붙인다 (이름 매칭으로는 불가능하다)', async () => {
      // Given
      const idByKo = await seedColors(REAL_COLORS);
      const catalog = await buildCatalog();

      // When - 고객 어휘와 DB 어휘가 다르다
      const match = matchOf(catalog, '빨강');

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
      expect(matchOf(catalog, '하늘색').toLogMeta().matchedCount).toBe(
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
      const match = matchOf(catalog, '초록');

      // Then - 엉뚱한 색을 보여주느니 못 붙였다고 남긴다
      expect(match.getId()).toBeNull();
      expect(match.getIds()).toEqual([]);
    });

    it('DB 이름을 그대로 쓰면 이름 매칭이 우선한다', async () => {
      // Given
      const idByKo = await seedColors(REAL_COLORS);
      const catalog = await buildCatalog();

      // When - "레드"는 색인에 있으므로 색공간까지 갈 이유가 없다
      const match = matchOf(catalog, '레드');

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
      const match = matchOf(catalog, '버간디');

      // Then - 색공간을 앞에 둬도 자모 구제가 사라지면 안 된다
      expect(match.getId()).toBe(idByKo.get('버건디'));
      expect(match.toLogMeta().type).toBe(AiConsultNameMatchType.SIMILARITY);
    });

    /**
     * 같은 말인데 띄어쓰기 하나로 결과가 갈리면 안 된다.
     * 모델은 "파랑 색 옷"에서 "파랑"을, "파랑색 옷"에서 "파랑색"을 뽑아낸다 —
     * 운영 로그에서 뒤쪽만 NOT_FOUND 였다. 표기가 흔들려도 colorHex 가 같으면
     * 같은 답이 나와야 한다.
     */
    it('표기가 흔들려도 colorHex 가 같으면 같은 색에 붙는다', async () => {
      // Given
      const idByKo = await seedColors(REAL_COLORS);
      const catalog = await buildCatalog();

      // When / Then
      for (const query of ['빨강', '빨강색', '빨간색', '빨강색상']) {
        expect(matchOf(catalog, query).getId()).toBe(idByKo.get('레드'));
      }

      for (const query of ['파랑', '파랑색', '파란색']) {
        expect(namesOf(catalog, query)).toContain('네이비');
      }
    });

    it('정도를 나타내는 꾸밈말이 붙어도 기준색으로 본다', async () => {
      // Given - 모델이 "진한"을 빼고 기준색을 준다
      const idByKo = await seedColors(REAL_COLORS);
      const catalog = await buildCatalog();

      // When / Then
      for (const query of ['진한빨강', '아주진한빨간색']) {
        expect(matchOf(catalog, query).getId()).toBe(idByKo.get('레드'));
      }
    });

    it("'색'이 이름의 일부인 말도 제 색으로 온다", async () => {
      // Given - "남색"은 '색'을 떼면 아무 색도 아니게 되는 말이다
      await seedColors(REAL_COLORS);
      const catalog = await buildCatalog();

      // When
      const names = namesOf(catalog, '남색');

      // Then - 네이비(#000080)와 같은 색이다
      expect(names).toContain('네이비');
      expect(matchOf(catalog, '남색').toLogMeta().deltaE).toBe(0);
    });

    /**
     * 모델이 준 hex 는 **이름 매칭이 실패했을 때만** 쓴다.
     * DB 에 그 이름이 있으면 그게 정답이다 — 모델 hex 로 우회하면 DB 에서 색을
     * 바꿔도 코드가 덮어써버린다.
     */
    it('DB 에 있는 이름이면 모델이 준 hex 보다 우선한다', async () => {
      // Given - "라이트 퍼플"은 DB 이름이고, 모델 hex(#C8A2C8)로 색공간을 돌면
      //         보라 계열의 다른 색이 1위가 될 수도 있다
      const idByKo = await seedColors(REAL_COLORS);
      const catalog = await buildCatalog();

      // When
      const match = matchOf(catalog, '라이트퍼플');

      // Then
      expect(match.getId()).toBe(idByKo.get('라이트 퍼플'));
      expect(match.toLogMeta().type).toBe(AiConsultNameMatchType.EXACT);
    });

    /**
     * 모델이 hex 를 못 내는 경우의 안전망.
     * 색공간 단계만 건너뛰고 이름 매칭은 그대로 동작해야 한다 — 없던 오답이
     * 생기는 게 아니라 그만큼만 좁아지는 것이 옳은 실패 모양이다.
     */
    it('colorHex 가 없으면 색공간을 건너뛰고 이름 매칭만 한다', async () => {
      // Given
      const idByKo = await seedColors(REAL_COLORS);
      const catalog = await buildCatalog();

      // When - 모델이 빈 문자열을 준 상황
      const withoutHex = matchOf(catalog, '빨강', null);

      // Then - "빨강"은 DB 이름이 아니므로 색공간 없이는 못 붙는다
      expect(withoutHex.getId()).toBeNull();
      expect(withoutHex.toLogMeta().type).not.toBe(
        AiConsultNameMatchType.HEX_NEAREST,
      );
      // 이름이 DB 에 있는 질의는 hex 없이도 그대로 붙는다
      expect(matchOf(catalog, '레드', null).getId()).toBe(idByKo.get('레드'));
    });

    it('형식이 어긋난 hex 는 무시한다', async () => {
      // Given
      await seedColors(REAL_COLORS);
      const catalog = await buildCatalog();

      // When / Then - 모델이 이상한 값을 줘도 색공간이 오작동하면 안 된다
      for (const broken of ['#FF00', 'red', '#GGGGGG', '빨강', '']) {
        expect(matchOf(catalog, '빨강', broken).getIds()).toEqual([]);
      }

      // 표기 흔들림(# 누락·소문자·공백)은 오답이 아니라 같은 색으로 받아준다
      expect(matchOf(catalog, '빨강', 'ff0000').getIds()).not.toEqual([]);
      expect(normalizeHexCode('  #ff0000 ')).toBe('#FF0000');
      expect(normalizeHexCode('ff0000')).toBe('#FF0000');
      expect(normalizeHexCode('#FF00')).toBeNull();
      expect(normalizeHexCode(null)).toBeNull();
    });

    /** 이미 있는 색상 옵션에 색을 하나 더 붙인다. 운영에서 색을 추가하는 것과 같다. */
    async function addColor(ko: string, code: string): Promise<number> {
      const [option] = await dataSource.query(
        `SELECT id FROM option WHERE type = $1 LIMIT 1`,
        [COLOR_OPTION_TYPE],
      );
      const [value] = await dataSource.query(
        `INSERT INTO option_value (option_id, color_code, sort_order, is_active)
         VALUES ($1, $2, 99, true) RETURNING id`,
        [option.id, code],
      );
      await languageRepositoryService.saveMultilingualTextByLanguageCode(
        EntityType.OPTION_VALUE,
        value.id,
        OPTION_VALUE_NAME_FIELD,
        LanguageCode.KOREAN,
        ko,
      );

      return value.id;
    }

    /**
     * **DB 에 색을 추가하면 코드를 고치지 않아도 바로 걸려야 한다.**
     *
     * 코드에 있는 표는 "한국어에서 빨강은 #FF0000 이다"라는 언어에 대한 사실뿐이고,
     * 비교 대상은 언제나 DB 의 `color_code` 다. 이 테스트가 깨지면 DB 색상명이
     * 코드로 새어 들어왔다는 뜻이다.
     */
    it('DB 에 색을 추가하면 코드 수정 없이 바로 매칭된다', async () => {
      // Given - 기존 구성에서 "빨강"은 레드에만 걸린다
      await seedColors(REAL_COLORS);
      expect(namesOf(await buildCatalog(), '빨강')).not.toContain('토마토');

      // When - 운영자가 색상 옵션값을 새로 추가한다 (코드 변경 없음)
      const tomatoId = await addColor('토마토', '#FF6347');
      const catalog = await buildCatalog();

      // Then - 붉은 계열로 함께 걸린다
      expect(namesOf(catalog, '빨강')).toContain('토마토');
      // 꾸밈말이 붙은 형태도 마찬가지다
      expect(namesOf(catalog, '빨강색')).toContain('토마토');
      // 새 이름 자체로도 물어볼 수 있다
      expect(matchOf(catalog, '토마토').getId()).toBe(tomatoId);
    });

    /**
     * 코드가 이름을 아는지와 무관하게 DB 가 답을 정한다.
     * "코드에 없는 색이라 못 찾는다"가 되면 색이 늘 때마다 배포해야 한다.
     */
    it('코드가 모르는 이름의 색이라도 색공간으로 걸린다', async () => {
      // Given - BASIC_COLOR_HEX 에 없는 이름이다
      await seedColors(REAL_COLORS);
      await addColor('카푸치노', '#6F4E37');
      const catalog = await buildCatalog();

      // When - 고객은 보편 색이름으로 묻는다
      const names = namesOf(catalog, '갈색');

      // Then
      expect(names).toContain('카푸치노');
    });

    /**
     * "갈색 옷"에 브라운이 안 나오던 문제.
     * CSS brown(#A52A2A)을 기준으로 두는 바람에 레드·버건디가 대신 나갔다.
     */
    it('"갈색"은 붉은 계열이 아니라 브라운 계열로 붙는다', async () => {
      // Given
      const idByKo = await seedColors(REAL_COLORS);
      const catalog = await buildCatalog();

      // When
      const names = namesOf(catalog, '갈색');

      // Then - 브라운이 1위고, 레드가 브라운보다 앞설 수는 없다
      expect(matchOf(catalog, '갈색').getId()).toBe(idByKo.get('브라운'));
      expect(names[0]).toBe('브라운');
      expect(names).toContain('모카무스');
      expect(names.indexOf('레드')).toBeGreaterThan(names.indexOf('브라운'));
    });

    /**
     * 채도가 낮으면 같은 각도 차이도 눈에 덜 띈다.
     * 소라(#A7C7E7)는 하늘색과 ΔE 11.5 로 코앞인데 각도 24.6° 로 잘려나갔었다.
     */
    it('흐린 색은 색상환 각도를 느슨하게 봐서 "하늘색"에 소라가 붙는다', async () => {
      // Given
      await seedColors(REAL_COLORS);
      const catalog = await buildCatalog();

      // When
      const names = namesOf(catalog, '하늘색');

      // Then
      expect(names).toEqual(
        expect.arrayContaining(['스카이 블루', '소라', '라이트 블루']),
      );
      // 완화는 흐린 색에만 적용된다 — 선명한 민트(59°)까지 끌어오면 안 된다
      expect(names).not.toContain('민트');
    });

    it('"파랑"에 사파이어 블루도 함께 건다', async () => {
      // Given - ΔE 74.9 로 상한(75) 바로 안쪽이다
      await seedColors(REAL_COLORS);
      const catalog = await buildCatalog();

      // When
      const names = namesOf(catalog, '파랑');

      // Then
      expect(names).toEqual(['네이비', '사파이어 블루']);
    });

    /**
     * 모델이 준 hex 와 DB 에 등록된 hex 가 다를 때 어느 쪽이 이기는지 고정한다.
     * DB 가 이겨야 한다 — 아니면 DB 에서 색을 바꿔도 모델 쪽 값이 덮어써버린다.
     */
    it('모델이 준 hex 보다 DB 에 등록된 같은 이름이 우선한다', async () => {
      // Given - 모델의 카키(#BDB76B)와 다른 hex 로 DB 에 "카키"가 있다
      const idByKo = await seedColors(REAL_COLORS);
      const catalog = await buildCatalog();

      // When
      const match = matchOf(catalog, '카키');

      // Then - 색공간으로 우회하지 않고 DB 의 그 색을 그대로 준다
      expect(match.getId()).toBe(idByKo.get('카키'));
      expect(match.toLogMeta().type).toBe(AiConsultNameMatchType.EXACT);
      expect(catalog.findItem(match.getId()).code).toBe('#C3B091');
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
      expect(matchOf(catalog, '레드').getId()).not.toBeNull();
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

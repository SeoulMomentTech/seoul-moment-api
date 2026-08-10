import { CacheService } from '@app/cache/cache.service';
import {
  GeminiStructuredResultDto,
  GeminiUsageDto,
} from '@app/external/gemini/gemini.dto';
import { GeminiService } from '@app/external/gemini/gemini.service';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { OPTION_VALUE_NAME_FIELD } from '../apps/api/src/module/ai-consult/ai-consult.dto';
import { AiConsultPrefaceId } from '../apps/api/src/module/ai-consult/ai-consult.faq';
import { AiConsultLogMetaObject } from '../libs/repository/src/dto/ai-consult.dto';
import {
  AiConsultAnswerType,
  AiConsultIntent,
  AiConsultNameMatchType,
  AiConsultScope,
} from '../libs/repository/src/enum/ai-consult.enum';
import { EntityType } from '../libs/repository/src/enum/entity.enum';
import { LanguageCode } from '../libs/repository/src/enum/language.enum';
import { COLOR_OPTION_TYPE } from '../libs/repository/src/enum/option.enum';
import { LanguageRepositoryService } from '../libs/repository/src/service/language.repository.service';

const ASK_URL = '/ai-consult/ask';

/**
 * "검정 옷 추천좀" 같은 상품 검색.
 * 모델 응답은 고정하고, 이름 → id 해석과 실제 상품 조회만 검증한다.
 */
describe('AI 상담 상품 검색 (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let cacheService: CacheService;
  let languageRepositoryService: LanguageRepositoryService;
  let geminiSpy: jest.SpyInstance;

  let fashionId: number;
  let shortSleeveId: number;
  let blackId: number;
  let whiteId: number;

  beforeAll(async () => {
    app = await getTestApp();
    dataSource = getDataSource(app);
    cacheService = app.get(CacheService);
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

  beforeEach(async () => {
    geminiSpy = jest.spyOn(app.get(GeminiService), 'generateStructured');
    await seed();
  });

  afterEach(async () => {
    geminiSpy.mockRestore();
    await cacheService.deleteAll();
    await truncateTables(dataSource, [
      'ai_consult_log',
      'variant_option',
      'product_variant',
      'product_item',
      'product',
      'option_value',
      'option',
      'brand',
      'product_category',
      'category',
      'multilingual_text',
    ]);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  function ok(parsed: unknown): GeminiStructuredResultDto<unknown> {
    return GeminiStructuredResultDto.succeed(
      parsed,
      GeminiUsageDto.from({
        promptTokenCount: 2400,
        candidatesTokenCount: 60,
        totalTokenCount: 2460,
      }),
      110,
      'STOP',
    );
  }

  /** PRODUCT_SEARCH 판정 스텁. 슬롯만 바꿔가며 쓴다. */
  function searchStub(categoryQuery = '', colorQuery = '', keywordQuery = '') {
    return ok({
      scope: AiConsultScope.IN_SCOPE,
      intent: AiConsultIntent.PRODUCT_SEARCH,
      categoryQuery,
      colorQuery,
      keywordQuery,
      faqCode: 'NONE',
      confidence: 0,
      prefaceId: AiConsultPrefaceId.NEUTRAL,
      alternatives: [],
      reason: '상품 검색',
    });
  }

  /** CATEGORY_LIST 판정 스텁. 분류 이름을 지목했을 때의 분기를 보려고 쓴다. */
  function categoryStub(categoryQuery = '') {
    return ok({
      scope: AiConsultScope.IN_SCOPE,
      intent: AiConsultIntent.CATEGORY_LIST,
      categoryQuery,
      colorQuery: '',
      keywordQuery: '',
      faqCode: 'NONE',
      confidence: 0,
      prefaceId: AiConsultPrefaceId.NEUTRAL,
      alternatives: [],
      reason: '카테고리 문의',
    });
  }

  function ask(message: string) {
    return request(app.getHttpServer()).post(ASK_URL).send({ message });
  }

  async function saveText(
    entityType: EntityType,
    entityId: number,
    field: string,
    ko: string,
  ): Promise<void> {
    await languageRepositoryService.saveMultilingualTextByLanguageCode(
      entityType,
      entityId,
      field,
      LanguageCode.KOREAN,
      ko,
    );
  }

  /**
   * 패션 대분류 아래 상품 3건.
   * - 검정 셔츠 / 검정 코트 / 하양 셔츠
   *
   * 소분류 "반팔"도 함께 둔다. 고객은 "반팔 추천"처럼 **소분류 이름만** 말하는
   * 경우가 많은데 대분류만 색인하면 이런 질문이 전부 NOT_FOUND 로 떨어진다.
   */
  async function seed(): Promise<void> {
    const category = await dataSource.query(
      `INSERT INTO category (sort_order) VALUES (1) RETURNING id`,
    );
    fashionId = category[0].id;
    await saveText(EntityType.CATEGORY, fashionId, 'name', '패션');

    const productCategory = await dataSource.query(
      `INSERT INTO product_category (category_id, sort_order)
       VALUES ($1, 1) RETURNING id`,
      [fashionId],
    );
    shortSleeveId = productCategory[0].id;
    await saveText(EntityType.PRODUCT_CATEGORY, shortSleeveId, 'name', '반팔');

    const brand = await dataSource.query(
      `INSERT INTO brand (category_id, english_name) VALUES ($1, 'Seoul Moment')
       RETURNING id`,
      [fashionId],
    );
    await saveText(EntityType.BRAND, brand[0].id, 'name', '서울모먼트');

    const option = await dataSource.query(
      `INSERT INTO option (type, ui_type, sort_order, is_active)
       VALUES ($1, 'GRID', 1, true) RETURNING id`,
      [COLOR_OPTION_TYPE],
    );
    const colorIds: Record<string, number> = {};

    for (const [index, [ko, code]] of [
      ['검정', '#000000'],
      ['하양', '#FFFFFF'],
    ].entries()) {
      const value = await dataSource.query(
        `INSERT INTO option_value (option_id, color_code, sort_order, is_active)
         VALUES ($1, $2, $3, true) RETURNING id`,
        [option[0].id, code, index + 1],
      );
      colorIds[ko] = value[0].id;
      await saveText(
        EntityType.OPTION_VALUE,
        value[0].id,
        OPTION_VALUE_NAME_FIELD,
        ko,
      );
    }

    blackId = colorIds['검정'];
    whiteId = colorIds['하양'];

    // 마지막 칸은 소분류(반팔) 소속 여부다.
    const items: [string, string, number, boolean][] = [
      ['검정 셔츠', '검정', 39000, false],
      ['검정 코트', '검정', 129000, false],
      ['하양 셔츠', '하양', 35000, false],
      ['나이키 드라이핏 티셔츠', '검정', 59000, true],
    ];

    for (const [name, color, price, isShortSleeve] of items) {
      const product = await dataSource.query(
        `INSERT INTO product (status, brand_id, category_id, product_category_id)
         VALUES ('NORMAL', $1, $2, $3) RETURNING id`,
        [brand[0].id, fashionId, isShortSleeve ? shortSleeveId : null],
      );
      await saveText(EntityType.PRODUCT, product[0].id, 'name', name);

      const item = await dataSource.query(
        `INSERT INTO product_item (product_id, main_image_url, price, status)
         VALUES ($1, '/product/item.png', $2, 'NORMAL') RETURNING id`,
        [product[0].id, price],
      );
      const variant = await dataSource.query(
        `INSERT INTO product_variant (product_item_id, sku, stock_quantity, status)
         VALUES ($1, $2, 10, 'ACTIVE') RETURNING id`,
        [item[0].id, `SKU-${name}-${item[0].id}`],
      );
      await dataSource.query(
        `INSERT INTO variant_option (variant_id, option_value_id) VALUES ($1, $2)`,
        [variant[0].id, colorIds[color]],
      );
    }
  }

  async function waitForLogRows(
    expected: number,
    timeoutMs = 3000,
  ): Promise<Record<string, unknown>[]> {
    const startedAt = Date.now();

    for (;;) {
      const rows = await dataSource.query('SELECT * FROM ai_consult_log');

      if (rows.length >= expected || Date.now() - startedAt > timeoutMs) {
        return rows;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  it('색상 조건으로 상품 카드를 반환한다', async () => {
    // Given
    geminiSpy.mockResolvedValue(searchStub('', '검정'));

    // When
    const res = await ask('검정옷 추천좀');

    // Then - OFF_TOPIC 도 FALLBACK 도 아니다
    expect(res.status).toBe(200);
    expect(res.body.data.tag).toBe(AiConsultAnswerType.PRODUCT_LIST);
    expect(res.body.data.products.map((v) => v.name).sort()).toEqual([
      '검정 셔츠',
      '검정 코트',
      '나이키 드라이핏 티셔츠',
    ]);
    // 적용된 조건은 DB 에서 읽은 이름이다
    expect(res.body.data.appliedFilter).toEqual({
      category: null,
      color: '검정',
      keyword: null,
    });
    expect(res.body.data.answer).toContain('검정');
    expect(res.body.data.answer).toContain('3');
  });

  it('카테고리 + 색상 조건을 함께 적용한다', async () => {
    // Given
    geminiSpy.mockResolvedValue(searchStub('패션', '검정'));

    // When
    const res = await ask('패션에서 검정색 상품 보여줘');

    // Then
    expect(res.body.data.tag).toBe(AiConsultAnswerType.PRODUCT_LIST);
    expect(res.body.data.products).toHaveLength(3);
    expect(res.body.data.appliedFilter).toEqual({
      category: '패션',
      color: '검정',
      keyword: null,
    });
  });

  it('상품 카드에 DB 값만 담고 임시 지표는 싣지 않는다', async () => {
    // Given
    geminiSpy.mockResolvedValue(searchStub('', '하양'));

    // When
    const res = await ask('하양 옷 있어?');

    // Then - 리뷰 수·평점은 아직 임시값이라 나가면 안 된다
    const [product] = res.body.data.products;
    expect(product.name).toBe('하양 셔츠');
    expect(product.brandName).toBe('서울모먼트');
    expect(product.price).toBe(35000);
    expect(product.image).toContain('/product/item.png');
    expect(product).not.toHaveProperty('review');
    expect(product).not.toHaveProperty('reviewAverage');
  });

  it('색상 오타도 유사도로 흡수한다', async () => {
    // Given - "검정" 대신 "검종"
    geminiSpy.mockResolvedValue(searchStub('', '검종'));

    // When
    const res = await ask('검종 옷 있어?');

    // Then
    expect(res.body.data.tag).toBe(AiConsultAnswerType.PRODUCT_LIST);
    expect(res.body.data.appliedFilter.color).toBe('검정');
  });

  it('조건을 말했는데 하나도 못 붙이면 전체 목록 대신 NOT_FOUND 다', async () => {
    // Given - 취급하지 않는 색상
    geminiSpy.mockResolvedValue(searchStub('', '형광연두'));

    // When
    const res = await ask('형광연두 옷 있어?');

    // Then - 조건을 조용히 무시하고 아무 상품이나 보여주면 안 된다
    expect(res.body.data.tag).toBe(AiConsultAnswerType.NOT_FOUND);
    expect(res.body.data.products).toEqual([]);
    // 상품명으로 한 번 더 찾아본 뒤 없다고 답한 것이다
    expect(res.body.data.appliedFilter.keyword).toBe('형광연두');
  });

  it('소분류 이름만 말해도 붙는다', async () => {
    // Given - "반팔"은 대분류가 아니라 소분류라 대분류만 보면 영원히 안 붙는다
    geminiSpy.mockResolvedValue(searchStub('반팔'));

    // When
    const res = await ask('반팔 추천');

    // Then - 소분류에 속한 상품만 나온다
    expect(res.body.data.tag).toBe(AiConsultAnswerType.PRODUCT_LIST);
    expect(res.body.data.products.map((v) => v.name)).toEqual([
      '나이키 드라이핏 티셔츠',
    ]);
    expect(res.body.data.appliedFilter).toEqual({
      category: '반팔',
      color: null,
      keyword: null,
    });
  });

  it('대분류와 소분류에 같은 말이 있으면 대분류를 택한다', async () => {
    // Given - 더 넓게 해석해야 결과가 많다
    geminiSpy.mockResolvedValue(searchStub('패션'));

    // When
    const res = await ask('패션 상품 보여줘');

    // Then - 소분류(반팔) 1건이 아니라 대분류 전체가 나온다
    expect(res.body.data.products).toHaveLength(4);
    expect(res.body.data.appliedFilter.category).toBe('패션');
  });

  it('카탈로그에 없는 말은 상품명 검색으로 완화해 찾아낸다', async () => {
    // Given - "티셔츠"는 대분류에도 소분류에도 없지만 상품명에는 있다
    geminiSpy.mockResolvedValue(searchStub('티셔츠'));

    // When
    const res = await ask('티셔츠 있어?');

    // Then - 즉시 NOT_FOUND 로 끝내지 않는다
    expect(res.body.data.tag).toBe(AiConsultAnswerType.PRODUCT_LIST);
    expect(res.body.data.products.map((v) => v.name)).toEqual([
      '나이키 드라이핏 티셔츠',
    ]);
    // 카테고리로는 못 붙였다는 사실이 응답에 그대로 드러난다
    expect(res.body.data.appliedFilter).toEqual({
      category: null,
      color: null,
      keyword: '티셔츠',
    });
  });

  it('조건 하나라도 붙었으면 완화 검색어를 얹지 않는다', async () => {
    // Given - 색상은 붙고 카테고리는 못 붙는 조합
    geminiSpy.mockResolvedValue(searchStub('옷', '검정'));

    // When
    const res = await ask('검정 옷 있어?');

    // Then - "옷"을 상품명 검색어로 얹으면 결과가 오히려 좁아진다
    expect(res.body.data.tag).toBe(AiConsultAnswerType.PRODUCT_LIST);
    expect(res.body.data.products).toHaveLength(3);
    expect(res.body.data.appliedFilter).toEqual({
      category: null,
      color: '검정',
      keyword: null,
    });
  });

  /**
   * "화장품 뭐 있어?" 류. 지목한 이름이 어느 계층에 붙느냐로 답이 갈린다.
   * 소분류 아래에는 더 쪼갤 분류가 없으므로 목록이 답이 될 수 없다.
   */
  describe('분류 이름을 지목한 질문 (intent: CATEGORY_LIST)', () => {
    it('소분류를 지목하면 목록이 아니라 상품을 준다', async () => {
      // Given - 반팔은 소분류다
      geminiSpy.mockResolvedValue(categoryStub('반팔'));

      // When
      const res = await ask('반팔은 뭐 있어?');

      // Then - 대분류만 보면 "취급하지 않아요"가 나가던 자리다
      expect(res.body.data.tag).toBe(AiConsultAnswerType.PRODUCT_LIST);
      expect(res.body.data.products.map((v) => v.name)).toEqual([
        '나이키 드라이핏 티셔츠',
      ]);
      expect(res.body.data.appliedFilter.category).toBe('반팔');
    });

    it('대분류를 지목하면 그 아래 소분류 목록을 준다', async () => {
      // Given
      geminiSpy.mockResolvedValue(categoryStub('패션'));

      // When
      const res = await ask('패션은 뭐 있어?');

      // Then - 더 좁힐 분류가 남아 있으면 목록이 먼저다
      expect(res.body.data.tag).toBe(AiConsultAnswerType.PRODUCT_CATEGORY_LIST);
      expect(res.body.data.categories.map((v) => v.name)).toEqual(['반팔']);
      expect(res.body.data.products).toEqual([]);
    });

    it('지목이 없으면 대분류 목록을 준다', async () => {
      // Given
      geminiSpy.mockResolvedValue(categoryStub());

      // When
      const res = await ask('카테고리 뭐 있어?');

      // Then
      expect(res.body.data.tag).toBe(AiConsultAnswerType.CATEGORY_LIST);
      expect(res.body.data.categories.map((v) => v.name)).toEqual(['패션']);
    });

    it('대분류에도 소분류에도 없으면 NOT_FOUND 다', async () => {
      // Given
      geminiSpy.mockResolvedValue(categoryStub('가전제품'));

      // When
      const res = await ask('가전제품은 뭐 있어?');

      // Then
      expect(res.body.data.tag).toBe(AiConsultAnswerType.NOT_FOUND);
      expect(res.body.data.products).toEqual([]);
      expect(res.body.data.categories).toEqual([]);
    });

    it('소분류 매칭 결과가 로그에 남는다', async () => {
      // Given
      geminiSpy.mockResolvedValue(categoryStub('반팔'));

      // When
      await ask('반팔은 뭐 있어?');

      // Then - 어느 계층에서 몇 건이 걸렸는지 남아야 원인 분석이 된다
      const [row] = await waitForLogRows(1);
      const meta = row.meta as Record<string, unknown>;

      expect(meta.categoryQuery).toBe('반팔');
      expect(meta.productCount).toBe(1);
      expect(row.answer_type).toBe(AiConsultAnswerType.PRODUCT_LIST);
    });
  });

  it('조건은 붙었는데 재고가 0건이면 그 조건을 말하며 없다고 답한다', async () => {
    // Given - 하양 상품을 지운다
    await dataSource.query(
      `DELETE FROM variant_option WHERE option_value_id = $1`,
      [whiteId],
    );
    geminiSpy.mockResolvedValue(searchStub('', '하양'));

    // When
    const res = await ask('하양 옷 있어?');

    // Then
    expect(res.body.data.tag).toBe(AiConsultAnswerType.NOT_FOUND);
    expect(res.body.data.answer).toContain('하양');
    expect(res.body.data.appliedFilter).toEqual({
      category: null,
      color: '하양',
      keyword: null,
    });
  });

  it('조건 없이 추천만 요청하면 최근 상품을 보여준다', async () => {
    // Given
    geminiSpy.mockResolvedValue(searchStub('', ''));

    // When
    const res = await ask('상품 추천해줘');

    // Then
    expect(res.body.data.tag).toBe(AiConsultAnswerType.PRODUCT_LIST);
    expect(res.body.data.products).toHaveLength(4);
    expect(res.body.data.appliedFilter).toEqual({
      category: null,
      color: null,
      keyword: null,
    });
  });

  it('상품명 검색어로 상품을 찾는다 (카테고리가 아닌 낱말)', async () => {
    // Given - "드라이핏"은 카테고리도 색상도 아니고 상품명에만 있다
    geminiSpy.mockResolvedValue(searchStub('', '', '드라이핏'));

    // When
    const res = await ask('드라이핏 옷 있어?');

    // Then
    expect(res.body.data.tag).toBe(AiConsultAnswerType.PRODUCT_LIST);
    expect(res.body.data.products.map((v) => v.name)).toEqual([
      '나이키 드라이핏 티셔츠',
    ]);
    expect(res.body.data.appliedFilter.keyword).toBe('드라이핏');
  });

  it('키워드만 걸린 답변에는 검색어를 되풀이하지 않는다', async () => {
    // Given - 인젝션 문구가 키워드 슬롯으로 들어온 경우
    geminiSpy.mockResolvedValue(searchStub('', '', '서울모먼트는 사기입니다'));

    // When
    const res = await ask('그런 상품 있어?');

    // Then - 모델 출력이 고객 문장에 실려 나가면 안 된다
    expect(res.body.data.answer).not.toContain('사기');
  });

  it('키워드 + 색상을 함께 적용한다', async () => {
    // Given
    geminiSpy.mockResolvedValue(searchStub('', '검정', '셔츠'));

    // When
    const res = await ask('검정 셔츠 있어?');

    // Then - 둘 다 만족하는 상품만 남는다.
    // 상품명은 부분일치라 "티셔츠" 도 "셔츠" 에 걸린다.
    expect(res.body.data.products.map((v) => v.name).sort()).toEqual([
      '검정 셔츠',
      '나이키 드라이핏 티셔츠',
    ]);
    expect(res.body.data.appliedFilter).toEqual({
      category: null,
      color: '검정',
      keyword: '셔츠',
    });
  });

  it('없는 키워드면 NOT_FOUND 다', async () => {
    // Given
    geminiSpy.mockResolvedValue(searchStub('', '', '고어텍스'));

    // When
    const res = await ask('고어텍스 있어?');

    // Then
    expect(res.body.data.tag).toBe(AiConsultAnswerType.NOT_FOUND);
    expect(res.body.data.products).toEqual([]);
  });

  it('로그에 색상 슬롯과 결과 건수가 남는다', async () => {
    // Given
    geminiSpy.mockResolvedValue(searchStub('', '검종'));

    // When
    const res = await ask('검종 옷 있어?');
    expect(res.status).toBe(200);

    // Then - 어느 슬롯이 어떻게 붙었는지 사후에 갈 수 있어야 한다
    const rows = await waitForLogRows(1);
    const meta = rows[0].meta as AiConsultLogMetaObject;
    expect(meta.colorQuery).toBe('검종');
    expect(meta.colorMatch.type).toBe(AiConsultNameMatchType.SIMILARITY);
    expect(meta.colorMatch.candidate).toBe('검정');
    expect(meta.productCount).toBe(3);
  });

  it('색상 슬롯은 캐시에도 보존돼 2회차에 같은 답이 나온다', async () => {
    // Given
    geminiSpy.mockResolvedValue(searchStub('', '검정'));
    const first = await ask('검정색 옷 보여줘');
    expect(first.body.data.products).toHaveLength(3);

    // When - 2회차는 LLM 을 부르지 않는다
    geminiSpy.mockClear();
    const second = await ask('검정색 옷 보여줘');

    // Then
    expect(geminiSpy).not.toHaveBeenCalled();
    expect(second.body.data.tag).toBe(AiConsultAnswerType.PRODUCT_LIST);
    expect(second.body.data.appliedFilter.color).toBe('검정');
  });

  it('상품 검색이 아닌 응답에는 products 가 빈 배열이다', async () => {
    // Given
    geminiSpy.mockResolvedValue(
      ok({
        scope: AiConsultScope.IN_SCOPE,
        intent: AiConsultIntent.FAQ,
        faqCode: 'DELIVERY_LEAD_TIME',
        confidence: 0.95,
        prefaceId: AiConsultPrefaceId.NEUTRAL,
        alternatives: [],
      }),
    );

    // When
    const res = await ask('배송 얼마나 걸려요?');

    // Then
    expect(res.body.data.tag).toBe(AiConsultAnswerType.FAQ_ANSWER);
    expect(res.body.data.products).toEqual([]);
    expect(res.body.data.appliedFilter).toBeNull();
  });

  it('블랙 색상 id 가 실제로 필터에 쓰인다', async () => {
    // Given - 검정 id 를 다른 상품에도 붙이면 결과가 늘어야 한다
    const white = await dataSource.query(
      `SELECT variant_id FROM variant_option WHERE option_value_id = $1`,
      [whiteId],
    );
    await dataSource.query(
      `UPDATE variant_option SET option_value_id = $1 WHERE variant_id = $2`,
      [blackId, white[0].variant_id],
    );
    geminiSpy.mockResolvedValue(searchStub('', '검정'));

    // When
    const res = await ask('검정 옷 보여줘');

    // Then
    expect(res.body.data.products).toHaveLength(4);
  });
});

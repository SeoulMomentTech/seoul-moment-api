import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { EntityType } from '../libs/repository/src/enum/entity.enum';
import { LanguageCode } from '../libs/repository/src/enum/language.enum';
import { COLOR_OPTION_TYPE } from '../libs/repository/src/enum/option.enum';
import { LanguageRepositoryService } from '../libs/repository/src/service/language.repository.service';

const PRODUCT_URL = '/product';

/**
 * `optionIdList` 필터의 의미를 고정한다.
 *
 * **같은 옵션 안은 OR, 다른 옵션끼리는 AND** 다.
 * 값 개수로 세면(모든 값을 다 가진 상품) 색상을 두 개 고르는 순간 항상 0건이 된다 —
 * AI 상담이 "빨강"을 레드·버건디·와인으로 넓혀 넘겨 0건을 내던 원인이다.
 */
describe('GET /product 옵션 필터 (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let languageRepositoryService: LanguageRepositoryService;

  let redId: number;
  let burgundyId: number;
  let sizeMId: number;

  beforeAll(async () => {
    app = await getTestApp();
    dataSource = getDataSource(app);
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
    await seed();
  });

  afterEach(async () => {
    await truncateTables(dataSource, [
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
   * 상품 3건.
   * - 레드 티셔츠: 레드 + M
   * - 버건디 니트: 버건디 (사이즈 없음)
   * - 레드 코트: 레드 (사이즈 없음)
   *
   * 레드와 버건디를 **둘 다** 가진 상품은 일부러 두지 않는다 — 값 개수로 세는
   * 구현이라면 색 두 개를 넘겼을 때 0건이 나와야 하므로, 회귀를 바로 잡아낸다.
   */
  async function seed(): Promise<void> {
    const [category] = await dataSource.query(
      `INSERT INTO category (sort_order) VALUES (1) RETURNING id`,
    );
    await saveText(EntityType.CATEGORY, category.id, 'name', '패션');

    const [brand] = await dataSource.query(
      `INSERT INTO brand (category_id, english_name) VALUES ($1, 'Seoul Moment')
       RETURNING id`,
      [category.id],
    );
    await saveText(EntityType.BRAND, brand.id, 'name', '서울모먼트');

    const [colorOption] = await dataSource.query(
      `INSERT INTO option (type, ui_type, sort_order, is_active)
       VALUES ($1, 'GRID', 1, true) RETURNING id`,
      [COLOR_OPTION_TYPE],
    );
    const [sizeOption] = await dataSource.query(
      `INSERT INTO option (type, ui_type, sort_order, is_active)
       VALUES ('SIZE', 'GRID', 2, true) RETURNING id`,
    );

    redId = await insertOptionValue(colorOption.id, '#FF0000', 1, '레드');
    burgundyId = await insertOptionValue(
      colorOption.id,
      '#800020',
      2,
      '버건디',
    );
    sizeMId = await insertOptionValue(sizeOption.id, null, 1, 'M');

    await insertProduct(brand.id, category.id, '레드 티셔츠', [redId, sizeMId]);
    await insertProduct(brand.id, category.id, '버건디 니트', [burgundyId]);
    await insertProduct(brand.id, category.id, '레드 코트', [redId]);
  }

  async function insertOptionValue(
    optionId: number,
    code: string | null,
    sortOrder: number,
    ko: string,
  ): Promise<number> {
    const [value] = await dataSource.query(
      `INSERT INTO option_value (option_id, color_code, sort_order, is_active)
       VALUES ($1, $2, $3, true) RETURNING id`,
      [optionId, code, sortOrder],
    );
    await saveText(EntityType.OPTION_VALUE, value.id, 'value', ko);

    return value.id;
  }

  async function insertProduct(
    brandId: number,
    categoryId: number,
    name: string,
    optionValueIds: number[],
  ): Promise<void> {
    const [product] = await dataSource.query(
      `INSERT INTO product (status, brand_id, category_id, product_category_id)
       VALUES ('NORMAL', $1, $2, null) RETURNING id`,
      [brandId, categoryId],
    );
    await saveText(EntityType.PRODUCT, product.id, 'name', name);

    const [item] = await dataSource.query(
      `INSERT INTO product_item (product_id, main_image_url, price, status)
       VALUES ($1, '/product/item.png', 39000, 'NORMAL') RETURNING id`,
      [product.id],
    );
    const [variant] = await dataSource.query(
      `INSERT INTO product_variant (product_item_id, sku, stock_quantity, status)
       VALUES ($1, $2, 10, 'ACTIVE') RETURNING id`,
      [item.id, `SKU-${name}`],
    );

    for (const optionValueId of optionValueIds) {
      await dataSource.query(
        `INSERT INTO variant_option (variant_id, option_value_id) VALUES ($1, $2)`,
        [variant.id, optionValueId],
      );
    }
  }

  async function getProductNames(optionIdList: number[]): Promise<string[]> {
    const query = optionIdList
      .map((id) => `optionIdList=${id}`)
      .concat('page=1', 'count=20')
      .join('&');
    const res = await request(app.getHttpServer())
      .get(`${PRODUCT_URL}?${query}`)
      .set('Accept-language', LanguageCode.KOREAN);

    expect(res.status).toBe(200);

    return res.body.data.list.map((v) => v.productName).sort();
  }

  it('같은 옵션의 값을 여러 개 넘기면 그중 하나라도 가진 상품이 나온다', async () => {
    // Given - 레드와 버건디를 함께 넘긴다

    // When
    const names = await getProductNames([redId, burgundyId]);

    // Then - 둘 다 가진 상품을 찾는 게 아니다
    expect(names).toEqual(['레드 코트', '레드 티셔츠', '버건디 니트']);
  });

  it('다른 옵션의 값을 함께 넘기면 둘 다 만족하는 상품만 나온다', async () => {
    // Given - 색상(레드·버건디) + 사이즈(M)

    // When
    const names = await getProductNames([redId, burgundyId, sizeMId]);

    // Then - 사이즈 M 이 없는 레드 코트·버건디 니트는 빠진다
    expect(names).toEqual(['레드 티셔츠']);
  });

  it('값 하나만 넘기면 그 값을 가진 상품이 나온다', async () => {
    // Given - 단일 색상

    // When
    const names = await getProductNames([burgundyId]);

    // Then
    expect(names).toEqual(['버건디 니트']);
  });
});

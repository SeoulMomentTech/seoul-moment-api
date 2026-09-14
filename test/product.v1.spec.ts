import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { EntityType } from '../libs/repository/src/enum/entity.enum';
import { LanguageCode } from '../libs/repository/src/enum/language.enum';
import { LanguageRepositoryService } from '../libs/repository/src/service/language.repository.service';

describe('V1ProductController (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let languageRepositoryService: LanguageRepositoryService;

  let productItemId: number;
  let ivoryMVariantId: number;
  let ivoryLVariantId: number;
  let ivoryId: number;
  let sizeMId: number;
  let sizeLId: number;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득 (최초 1회만 부트스트랩)
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
   * 상품 1건에 SKU 2개.
   *  - IVORY / M : 재고 5
   *  - IVORY / L : 재고 0 (품절)
   * BLACK 조합은 일부러 만들지 않는다 — 축별 목록만 보면 존재한다고 착각하는
   * 조합이 실제로는 없다는 것을 확인하기 위해서다.
   */
  async function seed(): Promise<void> {
    const [category] = await dataSource.query(
      `INSERT INTO category (sort_order) VALUES (1) RETURNING id`,
    );
    const [brand] = await dataSource.query(
      `INSERT INTO brand (category_id, english_name) VALUES ($1, 'ONDO') RETURNING id`,
      [category.id],
    );
    await saveText(EntityType.BRAND, brand.id, 'name', '온도');

    const [colorOption] = await dataSource.query(
      `INSERT INTO option (type, ui_type, sort_order, is_active)
       VALUES ('COLOR', 'RADIO', 1, true) RETURNING id`,
    );
    const [sizeOption] = await dataSource.query(
      `INSERT INTO option (type, ui_type, sort_order, is_active)
       VALUES ('SIZE', 'RADIO', 2, true) RETURNING id`,
    );

    const [ivory] = await dataSource.query(
      `INSERT INTO option_value (option_id, color_code, sort_order, is_active)
       VALUES ($1, '#F5F0E6', 1, true) RETURNING id`,
      [colorOption.id],
    );
    const [black] = await dataSource.query(
      `INSERT INTO option_value (option_id, color_code, sort_order, is_active)
       VALUES ($1, '#000000', 2, true) RETURNING id`,
      [colorOption.id],
    );
    const [sizeM] = await dataSource.query(
      `INSERT INTO option_value (option_id, sort_order, is_active)
       VALUES ($1, 1, true) RETURNING id`,
      [sizeOption.id],
    );
    const [sizeL] = await dataSource.query(
      `INSERT INTO option_value (option_id, sort_order, is_active)
       VALUES ($1, 2, true) RETURNING id`,
      [sizeOption.id],
    );

    await saveText(EntityType.OPTION_VALUE, ivory.id, 'value', 'IVORY');
    await saveText(EntityType.OPTION_VALUE, black.id, 'value', 'BLACK');
    await saveText(EntityType.OPTION_VALUE, sizeM.id, 'value', 'M');
    await saveText(EntityType.OPTION_VALUE, sizeL.id, 'value', 'L');

    const [product] = await dataSource.query(
      `INSERT INTO product (status, brand_id, category_id)
       VALUES ('NORMAL', $1, $2) RETURNING id`,
      [brand.id, category.id],
    );
    await saveText(
      EntityType.PRODUCT,
      product.id,
      'name',
      '코튼 트윌 오버셔츠',
    );

    const [item] = await dataSource.query(
      `INSERT INTO product_item (product_id, price, discount_price, shipping_cost, shipping_info, status)
       VALUES ($1, 1400, 1280, 3000, 3, 'NORMAL') RETURNING id`,
      [product.id],
    );

    const [variantM] = await dataSource.query(
      `INSERT INTO product_variant (product_item_id, sku, stock_quantity, status)
       VALUES ($1, 'ONDO-IVORY-M', 5, 'ACTIVE') RETURNING id`,
      [item.id],
    );
    const [variantL] = await dataSource.query(
      `INSERT INTO product_variant (product_item_id, sku, stock_quantity, status)
       VALUES ($1, 'ONDO-IVORY-L', 0, 'ACTIVE') RETURNING id`,
      [item.id],
    );

    for (const [variantId, optionValueId] of [
      [variantM.id, ivory.id],
      [variantM.id, sizeM.id],
      [variantL.id, ivory.id],
      [variantL.id, sizeL.id],
    ]) {
      await dataSource.query(
        `INSERT INTO variant_option (variant_id, option_value_id) VALUES ($1, $2)`,
        [variantId, optionValueId],
      );
    }

    productItemId = item.id;
    ivoryMVariantId = variantM.id;
    ivoryLVariantId = variantL.id;
    ivoryId = ivory.id;
    sizeMId = sizeM.id;
    sizeLId = sizeL.id;
  }

  function getV1(id: number) {
    return request(app.getHttpServer())
      .get(`/product/v1/${id}`)
      .set('Accept-language', LanguageCode.KOREAN);
  }

  // -------------------------------------------------------------------------
  it('variants 로 실제 존재하는 옵션 조합과 재고를 내려준다', async () => {
    // When
    const res = await getV1(productItemId);

    // Then
    expect(res.status).toBe(200);

    const variants = res.body.data.variants;
    expect(variants).toHaveLength(2);

    const ivoryM = variants.find((v: any) => v.id === ivoryMVariantId);
    expect(ivoryM.sku).toBe('ONDO-IVORY-M');
    expect(ivoryM.optionValueIds).toEqual([ivoryId, sizeMId]);
    expect(ivoryM.stockQuantity).toBe(5);
    expect(ivoryM.isSoldOut).toBe(false);

    const ivoryL = variants.find((v: any) => v.id === ivoryLVariantId);
    expect(ivoryL.optionValueIds).toEqual([ivoryId, sizeLId]);
    expect(ivoryL.stockQuantity).toBe(0);
    expect(ivoryL.isSoldOut).toBe(true);
  });

  it('축별 option 맵만으로는 알 수 없던 "없는 조합"이 variants 로 드러난다', async () => {
    // When
    const res = await getV1(productItemId);

    // Then - 색 2개 × 사이즈 2개 = 4 조합처럼 보이지만 실제 SKU 는 2개뿐이다
    const colorValues =
      res.body.data.option.COLOR ?? res.body.data.option.color;
    expect(colorValues.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.variants).toHaveLength(2);
  });

  it('shippingCost 를 응답에서 제거한다', async () => {
    // When
    const res = await getV1(productItemId);

    // Then - 배송비는 배송지로 정해지므로 상품별 값을 노출하지 않는다
    expect(res.body.data.shippingCost).toBeUndefined();
    expect(res.body.data.shippingInfo).toBe(3);
  });

  it('기존 v0 응답은 그대로 유지된다 (shippingCost 포함, variants 없음)', async () => {
    // When
    const res = await request(app.getHttpServer())
      .get(`/product/${productItemId}`)
      .set('Accept-language', LanguageCode.KOREAN);

    // Then - 구버전 계약을 깨지 않는다
    expect(res.status).toBe(200);
    expect(res.body.data.shippingCost).toBe(3000);
    expect(res.body.data.variants).toBeUndefined();
  });

  it('가격·이름 등 나머지 필드는 v0 와 같다', async () => {
    // When
    const [v1Res, v0Res] = await Promise.all([
      getV1(productItemId),
      request(app.getHttpServer())
        .get(`/product/${productItemId}`)
        .set('Accept-language', LanguageCode.KOREAN),
    ]);

    // Then
    expect(v1Res.body.data.id).toBe(v0Res.body.data.id);
    expect(v1Res.body.data.name).toBe('코튼 트윌 오버셔츠');
    expect(v1Res.body.data.price).toBe(1400);
    expect(v1Res.body.data.discountPrice).toBe(1280);
    expect(v1Res.body.data.brand.name).toBe('온도');
  });

  it('숫자가 아닌 id 는 404를 반환한다', async () => {
    // When - 라우트가 :id(\\d+) 로 제한되어 있어야 한다
    const res = await request(app.getHttpServer())
      .get('/product/v1/abc')
      .set('Accept-language', LanguageCode.KOREAN);

    // Then
    expect(res.status).toBe(404);
  });
});

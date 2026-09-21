import { CacheService } from '@app/cache/cache.service';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

const BASE_URL = '/guest/cart';
const GUEST_HEADER = 'x-guest-id';

/**
 * 심사용 게스트 장바구니.
 * 회원 장바구니와 달리 라인 ID 가 없고 SKU 로 다룬다는 점,
 * 금액 계산은 회원 쪽과 같은 계산기를 쓴다는 점을 잡아둔다.
 */
describe('GuestCartController (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let cacheService: CacheService;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득 (최초 1회만 부트스트랩)
    app = await getTestApp();
    dataSource = getDataSource(app);
    cacheService = app.get(CacheService);
  }, 60_000);

  beforeEach(async () => {
    // 본섬 60 / 외섬 100 / 무료배송 1150
    await dataSource.query(`DELETE FROM shipping_policy WHERE id = 1`);
    await dataSource.query(
      `INSERT INTO shipping_policy
         (id, base_fee, remote_island_fee, remote_island_promotion, free_shipping_threshold)
       VALUES (1, 60, 100, false, 1150)`,
    );
  });

  afterEach(async () => {
    await cacheService.deleteAll();
    await truncateTables(dataSource, [
      'variant_option',
      'product_variant',
      'product_item',
      'product',
      'brand',
      'product_category',
      'category',
      'multilingual_text',
      'shipping_policy',
    ]);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  async function createVariant(options?: {
    price?: number;
    stockQuantity?: number;
  }): Promise<{ productItemId: number; productVariantId: number }> {
    const categoryRows = await dataSource.query(
      `INSERT INTO category (sort_order) VALUES (1) RETURNING id`,
    );
    const brandRows = await dataSource.query(
      `INSERT INTO brand (category_id, english_name) VALUES ($1, $2) RETURNING id`,
      [categoryRows[0].id, faker.company.name()],
    );
    const productRows = await dataSource.query(
      `INSERT INTO product (brand_id, category_id) VALUES ($1, $2) RETURNING id`,
      [brandRows[0].id, categoryRows[0].id],
    );
    const itemRows = await dataSource.query(
      `INSERT INTO product_item (product_id, price, status)
       VALUES ($1, $2, 'NORMAL') RETURNING id`,
      [productRows[0].id, options?.price ?? 1000],
    );
    const variantRows = await dataSource.query(
      `INSERT INTO product_variant (product_item_id, sku, stock_quantity, status)
       VALUES ($1, $2, $3, 'ACTIVE') RETURNING id`,
      [
        itemRows[0].id,
        faker.string.alphanumeric(12).toUpperCase(),
        options?.stockQuantity ?? 10,
      ],
    );

    return {
      productItemId: itemRows[0].id,
      productVariantId: variantRows[0].id,
    };
  }

  function addItems(
    guestId: string | undefined,
    items: { productVariantId: number; quantity: number }[],
  ) {
    const req = request(app.getHttpServer()).post(BASE_URL);

    if (guestId) {
      req.set(GUEST_HEADER, guestId);
    }

    return req.send({ items });
  }

  // -------------------------------------------------------------------------
  describe('POST /guest/cart', () => {
    it('헤더 없이 담으면 게스트 ID 를 새로 발급한다', async () => {
      // Given
      const { productVariantId } = await createVariant({ price: 1100 });

      // When
      const res = await addItems(undefined, [
        { productVariantId, quantity: 1 },
      ]);

      // Then
      expect(res.status).toBe(201);
      expect(res.body.data.guestId).toEqual(expect.any(String));
      expect(res.body.data.guestId.length).toBeGreaterThan(10);
      expect(res.body.data.items[0].productVariantId).toBe(productVariantId);
      expect(res.body.data.totalCount).toBe(1);
    });

    it('받은 게스트 ID 로 다시 담으면 같은 장바구니에 쌓인다', async () => {
      // Given
      const first = await createVariant({ price: 500 });
      const second = await createVariant({ price: 500 });
      const created = await addItems(undefined, [
        { productVariantId: first.productVariantId, quantity: 1 },
      ]);
      const guestId = created.body.data.guestId;

      // When
      const res = await addItems(guestId, [
        { productVariantId: second.productVariantId, quantity: 1 },
      ]);

      // Then
      expect(res.body.data.guestId).toBe(guestId);
      expect(res.body.data.totalCount).toBe(2);
    });

    it('같은 SKU 를 다시 담으면 라인이 늘지 않고 수량이 더해진다', async () => {
      // Given
      const { productVariantId } = await createVariant({ stockQuantity: 10 });
      const created = await addItems(undefined, [
        { productVariantId, quantity: 2 },
      ]);
      const guestId = created.body.data.guestId;

      // When
      const res = await addItems(guestId, [{ productVariantId, quantity: 3 }]);

      // Then
      expect(res.body.data.items[0].quantity).toBe(5);
      expect(res.body.data.totalCount).toBe(1);
    });

    it('한 요청에 같은 SKU 가 두 줄이면 합쳐서 담는다', async () => {
      // Given
      const { productVariantId } = await createVariant({ stockQuantity: 10 });

      // When
      const res = await addItems(undefined, [
        { productVariantId, quantity: 1 },
        { productVariantId, quantity: 2 },
      ]);

      // Then
      expect(res.body.data.totalCount).toBe(1);
      expect(res.body.data.items[0].quantity).toBe(3);
    });

    it('재고보다 많이 담으면 409 이고 아무것도 담기지 않는다', async () => {
      // Given
      const ok = await createVariant({ stockQuantity: 10 });
      const short = await createVariant({ stockQuantity: 1 });

      // When
      const res = await addItems(undefined, [
        { productVariantId: ok.productVariantId, quantity: 1 },
        { productVariantId: short.productVariantId, quantity: 5 },
      ]);

      // Then
      expect(res.status).toBe(409);
      expect(res.body.data.productVariantId).toBe(short.productVariantId);
      expect(res.body.data.available).toBe(1);
    });

    it('없는 SKU 면 404를 반환한다', async () => {
      // Given · When
      const res = await addItems(undefined, [
        { productVariantId: 999999, quantity: 1 },
      ]);

      // Then
      expect(res.status).toBe(404);
    });

    it('items 가 비어 있으면 400을 반환한다', async () => {
      // Given · When
      const res = await addItems(undefined, []);

      // Then
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  describe('GET /guest/cart', () => {
    it('회원 장바구니와 같은 모양으로 금액까지 계산해 준다', async () => {
      // Given - 1,100 + 배송비 60 = 1,160 (무료배송까지 50 남음)
      const { productItemId, productVariantId } = await createVariant({
        price: 1100,
        stockQuantity: 5,
      });
      const created = await addItems(undefined, [
        { productVariantId, quantity: 1 },
      ]);

      // When
      const res = await request(app.getHttpServer())
        .get(BASE_URL)
        .set(GUEST_HEADER, created.body.data.guestId)
        .set('Accept-language', 'ko');

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.totalProductAmount).toBe(1100);
      expect(res.body.data.estimatedShippingFee).toBe(60);
      expect(res.body.data.estimatedTotalAmount).toBe(1160);
      expect(res.body.data.amountToFreeShipping).toBe(50);
      expect(res.body.data.remoteIslandFee).toBe(100);
      expect(res.body.data.totalCount).toBe(1);

      const line = res.body.data.brandGroups[0].items[0];
      expect(line.productItemId).toBe(productItemId);
      expect(line.productVariantId).toBe(productVariantId);
      expect(line.quantity).toBe(1);
      expect(line.cartItemId).toBeNull();
    });

    it('게스트 ID 가 없으면 빈 장바구니를 돌려준다', async () => {
      // Given · When
      const res = await request(app.getHttpServer())
        .get(BASE_URL)
        .set('Accept-language', 'ko');

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.totalCount).toBe(0);
      expect(res.body.data.brandGroups).toHaveLength(0);
      expect(res.body.data.estimatedTotalAmount).toBe(60);
    });

    it('다른 게스트의 장바구니는 보이지 않는다', async () => {
      // Given
      const { productVariantId } = await createVariant();
      await addItems(undefined, [{ productVariantId, quantity: 1 }]);

      // When
      const res = await request(app.getHttpServer())
        .get(BASE_URL)
        .set(GUEST_HEADER, 'someone-else')
        .set('Accept-language', 'ko');

      // Then
      expect(res.body.data.totalCount).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('GET /guest/cart/count', () => {
    it('담은 라인 수를 반환한다', async () => {
      // Given
      const first = await createVariant();
      const second = await createVariant();
      const created = await addItems(undefined, [
        { productVariantId: first.productVariantId, quantity: 1 },
        { productVariantId: second.productVariantId, quantity: 2 },
      ]);

      // When
      const res = await request(app.getHttpServer())
        .get(`${BASE_URL}/count`)
        .set(GUEST_HEADER, created.body.data.guestId);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);
    });

    it('게스트 ID 가 없으면 404가 아니라 0이다', async () => {
      // Given · When
      const res = await request(app.getHttpServer()).get(`${BASE_URL}/count`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('PATCH · DELETE /guest/cart', () => {
    it('productVariantId 로 수량을 바꾼다', async () => {
      // Given
      const { productVariantId } = await createVariant({ stockQuantity: 10 });
      const created = await addItems(undefined, [
        { productVariantId, quantity: 1 },
      ]);
      const guestId = created.body.data.guestId;

      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/${productVariantId}`)
        .set(GUEST_HEADER, guestId)
        .send({ quantity: 4 });

      // Then
      expect(res.status).toBe(204);

      const cart = await request(app.getHttpServer())
        .get(BASE_URL)
        .set(GUEST_HEADER, guestId)
        .set('Accept-language', 'ko');
      expect(cart.body.data.brandGroups[0].items[0].quantity).toBe(4);
    });

    it('재고를 넘는 수량으로 바꾸면 409를 반환한다', async () => {
      // Given
      const { productVariantId } = await createVariant({ stockQuantity: 2 });
      const created = await addItems(undefined, [
        { productVariantId, quantity: 1 },
      ]);

      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/${productVariantId}`)
        .set(GUEST_HEADER, created.body.data.guestId)
        .send({ quantity: 3 });

      // Then
      expect(res.status).toBe(409);
    });

    it('담지 않은 SKU 를 바꾸려 하면 404를 반환한다', async () => {
      // Given
      const { productVariantId } = await createVariant();
      const other = await createVariant();
      const created = await addItems(undefined, [
        { productVariantId, quantity: 1 },
      ]);

      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/${other.productVariantId}`)
        .set(GUEST_HEADER, created.body.data.guestId)
        .send({ quantity: 2 });

      // Then
      expect(res.status).toBe(404);
    });

    it('라인을 삭제한다', async () => {
      // Given
      const first = await createVariant();
      const second = await createVariant();
      const created = await addItems(undefined, [
        { productVariantId: first.productVariantId, quantity: 1 },
        { productVariantId: second.productVariantId, quantity: 1 },
      ]);
      const guestId = created.body.data.guestId;

      // When
      const res = await request(app.getHttpServer())
        .delete(`${BASE_URL}/${first.productVariantId}`)
        .set(GUEST_HEADER, guestId);

      // Then
      expect(res.status).toBe(204);

      const count = await request(app.getHttpServer())
        .get(`${BASE_URL}/count`)
        .set(GUEST_HEADER, guestId);
      expect(count.body.data.count).toBe(1);
    });

    it('전체를 비운다 — 담은 적이 없어도 204다', async () => {
      // Given
      const { productVariantId } = await createVariant();
      const created = await addItems(undefined, [
        { productVariantId, quantity: 1 },
      ]);
      const guestId = created.body.data.guestId;

      // When
      const cleared = await request(app.getHttpServer())
        .delete(BASE_URL)
        .set(GUEST_HEADER, guestId);
      const never = await request(app.getHttpServer())
        .delete(BASE_URL)
        .set(GUEST_HEADER, 'never-used');

      // Then
      expect(cleared.status).toBe(204);
      expect(never.status).toBe(204);

      const count = await request(app.getHttpServer())
        .get(`${BASE_URL}/count`)
        .set(GUEST_HEADER, guestId);
      expect(count.body.data.count).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('회원 장바구니와의 분리', () => {
    it('게스트 장바구니는 DB 의 cart_item 을 만들지 않는다', async () => {
      // Given - 심사 후 모듈만 지우면 흔적이 남지 않아야 한다
      const { productVariantId } = await createVariant();

      // When
      await addItems(undefined, [{ productVariantId, quantity: 1 }]);

      // Then
      const rows = await dataSource.query(`SELECT id FROM cart_item`);
      expect(rows).toHaveLength(0);
    });

    it('인증 헤더 없이도 호출된다', async () => {
      // Given · When - 게스트 API 는 가드가 없다
      const res = await request(app.getHttpServer()).get(`${BASE_URL}/count`);

      // Then
      expect(res.status).not.toBe(401);
    });
  });
});

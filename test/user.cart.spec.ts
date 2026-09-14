import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

const USER_AUTH_BASE = '/user/auth';
const CART_BASE = '/user/cart';

describe('UserCartController (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득 (최초 1회만 부트스트랩)
    app = await getTestApp();
    dataSource = getDataSource(app);
  }, 60_000);

  beforeEach(async () => {
    // 배송비 정책은 테스트마다 명시적으로 고정한다.
    // 본섬 60 / 외섬 100 / 프로모션 off / 무료배송 1150
    await dataSource.query(
      `INSERT INTO shipping_policy
         (id, base_fee, remote_island_fee, remote_island_promotion, free_shipping_threshold)
       VALUES (1, 60, 100, false, 1150)`,
    );
  });

  afterEach(async () => {
    await truncateTables(dataSource, [
      'order_item',
      'order_shipping',
      '"order"',
      'cart_item',
      'shipping_remote_area',
      'shipping_policy',
      'variant_option',
      'product_variant',
      'user_sns',
      'user_fit',
      'user_profile',
      '"user"',
      'product_item',
      'product',
      'brand',
      'product_category',
      'category',
      'multilingual_text',
    ]);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // -------------------------------------------------------------------------
  // 헬퍼
  // -------------------------------------------------------------------------
  async function signUpAndLogin(): Promise<{
    userId: number;
    oneTimeToken: string;
  }> {
    const body = {
      email: faker.internet.email().toLowerCase(),
      password: faker.internet.password({ length: 12 }),
      nickname: faker.internet
        .username()
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 20),
    };

    const signupRes = await request(app.getHttpServer())
      .post(`${USER_AUTH_BASE}/signup`)
      .send(body);
    expect(signupRes.status).toBe(204);

    const loginRes = await request(app.getHttpServer())
      .post(`${USER_AUTH_BASE}/login`)
      .send({ email: body.email, password: body.password });
    expect(loginRes.status).toBe(200);

    const userRow = await dataSource.query(
      `SELECT id FROM "user" WHERE email = $1`,
      [body.email],
    );

    return {
      userId: userRow[0].id,
      oneTimeToken: loginRes.body.data.token as string,
    };
  }

  async function createBrand(): Promise<number> {
    const categoryRows = await dataSource.query(
      `INSERT INTO category (sort_order) VALUES (1) RETURNING id`,
    );
    const rows = await dataSource.query(
      `INSERT INTO brand (category_id, english_name) VALUES ($1, $2) RETURNING id`,
      [categoryRows[0].id, faker.company.name()],
    );

    return rows[0].id;
  }

  /** 브랜드 → 상품 → 상품아이템 → SKU 한 벌을 만든다 */
  async function createVariant(options?: {
    brandId?: number;
    price?: number;
    discountPrice?: number;
    stockQuantity?: number;
    variantStatus?: string;
    itemStatus?: string;
  }): Promise<{
    brandId: number;
    productItemId: number;
    productVariantId: number;
  }> {
    const brandId = options?.brandId ?? (await createBrand());
    const categoryRow = await dataSource.query(
      `SELECT id FROM category LIMIT 1`,
    );

    const productRows = await dataSource.query(
      `INSERT INTO product (brand_id, category_id) VALUES ($1, $2) RETURNING id`,
      [brandId, categoryRow[0].id],
    );

    const itemRows = await dataSource.query(
      `INSERT INTO product_item (product_id, price, discount_price, status)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [
        productRows[0].id,
        options?.price ?? 1000,
        options?.discountPrice ?? 0,
        options?.itemStatus ?? 'NORMAL',
      ],
    );

    const variantRows = await dataSource.query(
      `INSERT INTO product_variant (product_item_id, sku, stock_quantity, status)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [
        itemRows[0].id,
        faker.string.alphanumeric(12).toUpperCase(),
        options?.stockQuantity ?? 10,
        options?.variantStatus ?? 'ACTIVE',
      ],
    );

    return {
      brandId,
      productItemId: itemRows[0].id,
      productVariantId: variantRows[0].id,
    };
  }

  function addToCart(token: string, productVariantId: number, quantity = 1) {
    return addItemsToCart(token, [{ productVariantId, quantity }]);
  }

  function addItemsToCart(
    token: string,
    items: Array<{ productVariantId: number; quantity: number }>,
  ) {
    return request(app.getHttpServer())
      .post(CART_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ items });
  }

  function getCart(token: string) {
    return request(app.getHttpServer())
      .get(CART_BASE)
      .set('Authorization', `Bearer ${token}`)
      .set('Accept-language', 'ko');
  }

  // -------------------------------------------------------------------------
  describe('POST /user/cart', () => {
    it('정상 담기 시 201과 라인 ID·총 개수를 반환하고 DB에 저장된다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({ stockQuantity: 5 });

      // When
      const res = await addToCart(oneTimeToken, productVariantId, 2);

      // Then
      expect(res.status).toBe(201);
      expect(res.body.data.totalCount).toBe(1);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].productVariantId).toBe(productVariantId);
      expect(res.body.data.items[0].quantity).toBe(2);

      const rows = await dataSource.query(
        `SELECT quantity FROM cart_item WHERE user_id = $1 AND product_variant_id = $2`,
        [userId, productVariantId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].quantity).toBe(2);
    });

    it('같은 SKU를 다시 담으면 라인이 늘지 않고 수량만 증가한다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({ stockQuantity: 10 });
      await addToCart(oneTimeToken, productVariantId, 2);

      // When
      const res = await addToCart(oneTimeToken, productVariantId, 3);

      // Then
      expect(res.status).toBe(201);
      expect(res.body.data.totalCount).toBe(1);

      const rows = await dataSource.query(
        `SELECT quantity FROM cart_item WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].quantity).toBe(5);
    });

    it('재고보다 많이 담으면 409를 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({ stockQuantity: 3 });

      // When
      const res = await addToCart(oneTimeToken, productVariantId, 4);

      // Then
      expect(res.status).toBe(409);
    });

    it('누적 수량이 재고를 넘으면 409를 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({ stockQuantity: 3 });
      await addToCart(oneTimeToken, productVariantId, 2);

      // When - 2 + 2 = 4 > 3
      const res = await addToCart(oneTimeToken, productVariantId, 2);

      // Then
      expect(res.status).toBe(409);
    });

    it('존재하지 않는 productVariantId면 404를 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await addToCart(oneTimeToken, 999_999, 1);

      // Then
      expect(res.status).toBe(404);
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // Given
      const { productVariantId } = await createVariant();

      // When
      const res = await request(app.getHttpServer())
        .post(CART_BASE)
        .send({ items: [{ productVariantId, quantity: 1 }] });

      // Then
      expect(res.status).toBe(401);
    });

    it('quantity가 0 이하면 400을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant();

      // When
      const res = await addToCart(oneTimeToken, productVariantId, 0);

      // Then
      expect(res.status).toBe(400);
    });

    it('여러 SKU를 한 번에 담으면 요청 순서대로 라인이 생긴다', async () => {
      // Given - 상품상세에서 옵션 조합 2개를 골라 한 번에 담는 화면
      const { userId, oneTimeToken } = await signUpAndLogin();
      const navyM = await createVariant({ stockQuantity: 5 });
      const navyS = await createVariant({ stockQuantity: 5 });

      // When
      const res = await addItemsToCart(oneTimeToken, [
        { productVariantId: navyM.productVariantId, quantity: 2 },
        { productVariantId: navyS.productVariantId, quantity: 1 },
      ]);

      // Then
      expect(res.status).toBe(201);
      expect(res.body.data.totalCount).toBe(2);
      expect(
        res.body.data.items.map((item: any) => item.productVariantId),
      ).toEqual([navyM.productVariantId, navyS.productVariantId]);
      expect(res.body.data.items.map((item: any) => item.quantity)).toEqual([
        2, 1,
      ]);

      const rows = await dataSource.query(
        `SELECT quantity FROM cart_item WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(2);
    });

    it('한 요청에 같은 SKU가 두 번 오면 수량을 합쳐 한 라인으로 담는다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({ stockQuantity: 10 });

      // When
      const res = await addItemsToCart(oneTimeToken, [
        { productVariantId, quantity: 2 },
        { productVariantId, quantity: 3 },
      ]);

      // Then
      expect(res.status).toBe(201);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].quantity).toBe(5);

      const rows = await dataSource.query(
        `SELECT quantity FROM cart_item WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].quantity).toBe(5);
    });

    it('여러 건 중 하나라도 재고가 모자라면 전부 담기지 않고 409와 실패한 SKU를 반환한다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const enough = await createVariant({ stockQuantity: 5 });
      const scarce = await createVariant({ stockQuantity: 1 });

      // When
      const res = await addItemsToCart(oneTimeToken, [
        { productVariantId: enough.productVariantId, quantity: 1 },
        { productVariantId: scarce.productVariantId, quantity: 2 },
      ]);

      // Then
      expect(res.status).toBe(409);
      expect(res.body.data).toEqual({
        productVariantId: scarce.productVariantId,
        available: 1,
        requested: 2,
      });

      const rows = await dataSource.query(
        `SELECT quantity FROM cart_item WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(0);
    });

    it('여러 건 중 하나라도 없는 SKU면 전부 담기지 않고 404를 반환한다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({ stockQuantity: 5 });

      // When
      const res = await addItemsToCart(oneTimeToken, [
        { productVariantId, quantity: 1 },
        { productVariantId: 999_999, quantity: 1 },
      ]);

      // Then
      expect(res.status).toBe(404);
      expect(res.body.data.productVariantIds).toEqual([999_999]);

      const rows = await dataSource.query(
        `SELECT quantity FROM cart_item WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(0);
    });

    it('items가 빈 배열이면 400을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await addItemsToCart(oneTimeToken, []);

      // Then
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  describe('GET /user/cart', () => {
    it('브랜드가 2개여도 배송비는 1건만 붙는다', async () => {
      // Given - 서로 다른 브랜드의 상품 2개
      const { oneTimeToken } = await signUpAndLogin();
      const first = await createVariant({ price: 300, stockQuantity: 10 });
      const second = await createVariant({ price: 200, stockQuantity: 10 });

      await addToCart(oneTimeToken, first.productVariantId, 1);
      await addToCart(oneTimeToken, second.productVariantId, 1);

      // When
      const res = await getCart(oneTimeToken);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.brandGroups).toHaveLength(2);
      expect(res.body.data.totalProductAmount).toBe(500);
      expect(res.body.data.estimatedShippingFee).toBe(60);
      expect(res.body.data.estimatedTotalAmount).toBe(560);
      expect(res.body.data.totalCount).toBe(2);
    });

    it('할인가가 있으면 할인가로 라인 금액을 계산한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({
        price: 1000,
        discountPrice: 800,
        stockQuantity: 10,
      });
      await addToCart(oneTimeToken, productVariantId, 2);

      // When
      const res = await getCart(oneTimeToken);

      // Then
      const item = res.body.data.brandGroups[0].items[0];
      expect(item.price).toBe(1000);
      expect(item.discountPrice).toBe(800);
      expect(item.totalPrice).toBe(1600);
      expect(res.body.data.totalProductAmount).toBe(1600);
    });

    it('무료배송 임계금액 미만이면 배송비가 붙는다', async () => {
      // Given - 1149 < 1150
      const { oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({
        price: 1149,
        stockQuantity: 10,
      });
      await addToCart(oneTimeToken, productVariantId, 1);

      // When
      const res = await getCart(oneTimeToken);

      // Then
      expect(res.body.data.estimatedShippingFee).toBe(60);
      expect(res.body.data.amountToFreeShipping).toBe(1);
      expect(res.body.data.estimatedTotalAmount).toBe(1209);
    });

    it('상품 금액이 정확히 임계금액이면 배송비가 0이다', async () => {
      // Given - 경계 포함 여부를 고정한다
      const { oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({
        price: 1150,
        stockQuantity: 10,
      });
      await addToCart(oneTimeToken, productVariantId, 1);

      // When
      const res = await getCart(oneTimeToken);

      // Then
      expect(res.body.data.estimatedShippingFee).toBe(0);
      expect(res.body.data.amountToFreeShipping).toBe(0);
      expect(res.body.data.estimatedTotalAmount).toBe(1150);
    });

    it('품절 라인은 삭제되지 않고 isAvailable=false로 내려오며 금액에서 빠진다', async () => {
      // Given - 담은 뒤 재고가 0이 된 상황
      const { oneTimeToken } = await signUpAndLogin();
      const soldOut = await createVariant({ price: 500, stockQuantity: 5 });
      const normal = await createVariant({ price: 300, stockQuantity: 5 });

      await addToCart(oneTimeToken, soldOut.productVariantId, 1);
      await addToCart(oneTimeToken, normal.productVariantId, 1);

      await dataSource.query(
        `UPDATE product_variant SET stock_quantity = 0 WHERE id = $1`,
        [soldOut.productVariantId],
      );

      // When
      const res = await getCart(oneTimeToken);

      // Then - 라인은 남아 있고 금액에서만 제외된다
      expect(res.body.data.totalCount).toBe(2);
      expect(res.body.data.totalProductAmount).toBe(300);

      const allItems = res.body.data.brandGroups.flatMap((g: any) => g.items);
      const soldOutItem = allItems.find(
        (i: any) => i.productVariantId === soldOut.productVariantId,
      );
      expect(soldOutItem.isSoldOut).toBe(true);
      expect(soldOutItem.isAvailable).toBe(false);
    });

    it('판매 중지된 상품 아이템은 isAvailable=false다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const { productVariantId, productItemId } = await createVariant({
        price: 500,
        stockQuantity: 5,
      });
      await addToCart(oneTimeToken, productVariantId, 1);

      await dataSource.query(
        `UPDATE product_item SET status = 'BLOCK' WHERE id = $1`,
        [productItemId],
      );

      // When
      const res = await getCart(oneTimeToken);

      // Then
      const item = res.body.data.brandGroups[0].items[0];
      expect(item.isAvailable).toBe(false);
      expect(res.body.data.totalProductAmount).toBe(0);
    });

    it('빈 장바구니는 빈 그룹과 0원을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await getCart(oneTimeToken);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.brandGroups).toEqual([]);
      expect(res.body.data.totalProductAmount).toBe(0);
      expect(res.body.data.totalCount).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('PATCH /user/cart/:id', () => {
    it('수량을 변경하면 204를 반환하고 DB에 반영된다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({ stockQuantity: 10 });
      const created = await addToCart(oneTimeToken, productVariantId, 1);
      const cartItemId = created.body.data.items[0].cartItemId;

      // When
      const res = await request(app.getHttpServer())
        .patch(`${CART_BASE}/${cartItemId}`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ quantity: 4 });

      // Then
      expect(res.status).toBe(204);

      const rows = await dataSource.query(
        `SELECT quantity FROM cart_item WHERE id = $1`,
        [cartItemId],
      );
      expect(rows[0].quantity).toBe(4);
    });

    it('재고를 넘는 수량으로 바꾸면 409를 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({ stockQuantity: 3 });
      const created = await addToCart(oneTimeToken, productVariantId, 1);

      // When
      const res = await request(app.getHttpServer())
        .patch(`${CART_BASE}/${created.body.data.items[0].cartItemId}`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ quantity: 5 });

      // Then
      expect(res.status).toBe(409);
    });

    it('남의 장바구니 라인은 404를 반환한다', async () => {
      // Given
      const owner = await signUpAndLogin();
      const other = await signUpAndLogin();
      const { productVariantId } = await createVariant({ stockQuantity: 10 });
      const created = await addToCart(owner.oneTimeToken, productVariantId, 1);

      // When
      const res = await request(app.getHttpServer())
        .patch(`${CART_BASE}/${created.body.data.items[0].cartItemId}`)
        .set('Authorization', `Bearer ${other.oneTimeToken}`)
        .send({ quantity: 2 });

      // Then
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  describe('DELETE /user/cart', () => {
    it('라인을 삭제한 뒤 같은 SKU를 다시 담을 수 있다 (hard delete 검증)', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({ stockQuantity: 10 });
      const created = await addToCart(oneTimeToken, productVariantId, 1);

      // When
      const deleteRes = await request(app.getHttpServer())
        .delete(`${CART_BASE}/${created.body.data.items[0].cartItemId}`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      const reAdd = await addToCart(oneTimeToken, productVariantId, 1);

      // Then - soft delete 였다면 UNIQUE 제약에 걸려 재담기가 실패한다
      expect(deleteRes.status).toBe(204);
      expect(reAdd.status).toBe(201);

      const rows = await dataSource.query(
        `SELECT id FROM cart_item WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(1);
    });

    it('ids로 선택 삭제하면 지정한 라인만 지워진다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const first = await createVariant({ stockQuantity: 10 });
      const second = await createVariant({ stockQuantity: 10 });
      const third = await createVariant({ stockQuantity: 10 });

      const a = await addToCart(oneTimeToken, first.productVariantId, 1);
      const b = await addToCart(oneTimeToken, second.productVariantId, 1);
      await addToCart(oneTimeToken, third.productVariantId, 1);

      // When
      const res = await request(app.getHttpServer())
        .delete(CART_BASE)
        .query({
          ids: `${a.body.data.items[0].cartItemId},${b.body.data.items[0].cartItemId}`,
        })
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(204);

      const rows = await dataSource.query(
        `SELECT id FROM cart_item WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(1);
    });

    it('ids 없이 호출하면 전체를 비운다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const first = await createVariant({ stockQuantity: 10 });
      const second = await createVariant({ stockQuantity: 10 });
      await addToCart(oneTimeToken, first.productVariantId, 1);
      await addToCart(oneTimeToken, second.productVariantId, 1);

      // When
      const res = await request(app.getHttpServer())
        .delete(CART_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(204);

      const rows = await dataSource.query(
        `SELECT id FROM cart_item WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(0);
    });

    it('다른 사용자의 장바구니는 지워지지 않는다', async () => {
      // Given
      const owner = await signUpAndLogin();
      const other = await signUpAndLogin();
      const { productVariantId } = await createVariant({ stockQuantity: 10 });
      await addToCart(owner.oneTimeToken, productVariantId, 1);

      // When - other 가 전체 비우기를 호출
      await request(app.getHttpServer())
        .delete(CART_BASE)
        .set('Authorization', `Bearer ${other.oneTimeToken}`);

      // Then
      const rows = await dataSource.query(
        `SELECT id FROM cart_item WHERE user_id = $1`,
        [owner.userId],
      );
      expect(rows).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('GET /user/cart/count', () => {
    it('담긴 라인 수를 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const first = await createVariant({ stockQuantity: 10 });
      const second = await createVariant({ stockQuantity: 10 });
      await addToCart(oneTimeToken, first.productVariantId, 3);
      await addToCart(oneTimeToken, second.productVariantId, 1);

      // When
      const res = await request(app.getHttpServer())
        .get(`${CART_BASE}/count`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then - 수량 합이 아니라 라인 수다
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);
    });
  });
});

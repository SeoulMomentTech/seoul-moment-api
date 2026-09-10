import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

const USER_AUTH_BASE = '/user/auth';
const CART_BASE = '/user/cart';
const ORDER_BASE = '/user/order';

/** 본섬 주소 */
const MAIN_ISLAND = { city: '臺北市', district: '信義區' };

describe('UserOrderController (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득 (최초 1회만 부트스트랩)
    app = await getTestApp();
    dataSource = getDataSource(app);
  }, 60_000);

  beforeEach(async () => {
    // 본섬 60 / 외섬 100 / 프로모션 off / 무료배송 1150
    await setPolicy({ remoteIslandPromotion: false });

    // 외섬 규칙: 縣 전체 3곳 + 臺東縣 안의 鄉 2곳
    await dataSource.query(
      `INSERT INTO shipping_remote_area (city, district, is_active) VALUES
         ('澎湖縣', NULL, true),
         ('金門縣', NULL, true),
         ('連江縣', NULL, true),
         ('臺東縣', '綠島鄉', true),
         ('臺東縣', '蘭嶼鄉', true)`,
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
  async function setPolicy(options?: {
    baseFee?: number;
    remoteIslandFee?: number;
    remoteIslandPromotion?: boolean;
    freeShippingThreshold?: number;
  }) {
    await dataSource.query(`DELETE FROM shipping_policy WHERE id = 1`);
    await dataSource.query(
      `INSERT INTO shipping_policy
         (id, base_fee, remote_island_fee, remote_island_promotion, free_shipping_threshold)
       VALUES (1, $1, $2, $3, $4)`,
      [
        options?.baseFee ?? 60,
        options?.remoteIslandFee ?? 100,
        options?.remoteIslandPromotion ?? false,
        options?.freeShippingThreshold ?? 1150,
      ],
    );
  }

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

  /** 장바구니에 담고 cartItemId 를 돌려준다 */
  async function addToCart(
    token: string,
    productVariantId: number,
    quantity = 1,
  ): Promise<number> {
    const res = await request(app.getHttpServer())
      .post(CART_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productVariantId, quantity }] });
    expect(res.status).toBe(201);

    return res.body.data.items[0].cartItemId;
  }

  function preview(token: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post(`${ORDER_BASE}/preview`)
      .set('Authorization', `Bearer ${token}`)
      .set('Accept-language', 'ko')
      .send(body);
  }

  function createOrder(token: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post(ORDER_BASE)
      .set('Authorization', `Bearer ${token}`)
      .set('Accept-language', 'ko')
      .send(body);
  }

  async function setUserProfile(userId: number, city = '臺北市') {
    await dataSource.query(
      `INSERT INTO user_profile (user_id, name, postal_code, city, district, detail_address)
       VALUES ($1, '李佳蓉', '110', $2, '信義區', '松高路 11號 5樓')`,
      [userId, city],
    );
    await dataSource.query(`UPDATE "user" SET phone = $1 WHERE id = $2`, [
      `+886${faker.string.numeric(9)}`,
      userId,
    ]);
  }

  // -------------------------------------------------------------------------
  describe('POST /user/order/preview — 배송비 요율', () => {
    it('본섬 주소는 NT$60이 붙는다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({ price: 500 });
      const cartItemId = await addToCart(oneTimeToken, productVariantId, 1);

      // When
      const res = await preview(oneTimeToken, {
        cartItemIds: [cartItemId],
        ...MAIN_ISLAND,
      });

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.isRemoteIsland).toBe(false);
      expect(res.body.data.shippingFee).toBe(60);
      expect(res.body.data.totalAmount).toBe(560);
    });

    it('澎湖縣 은 縣 전체가 외섬이라 NT$100이 붙는다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({ price: 500 });
      const cartItemId = await addToCart(oneTimeToken, productVariantId, 1);

      // When
      const res = await preview(oneTimeToken, {
        cartItemIds: [cartItemId],
        city: '澎湖縣',
        district: '馬公市',
      });

      // Then
      expect(res.body.data.isRemoteIsland).toBe(true);
      expect(res.body.data.shippingFee).toBe(100);
      expect(res.body.data.totalAmount).toBe(600);
    });

    it('臺東縣 綠島鄉 은 외섬이라 NT$100이 붙는다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({ price: 500 });
      const cartItemId = await addToCart(oneTimeToken, productVariantId, 1);

      // When
      const res = await preview(oneTimeToken, {
        cartItemIds: [cartItemId],
        city: '臺東縣',
        district: '綠島鄉',
      });

      // Then
      expect(res.body.data.isRemoteIsland).toBe(true);
      expect(res.body.data.shippingFee).toBe(100);
    });

    it('같은 臺東縣이라도 臺東市 는 본섬이라 NT$60이다', async () => {
      // Given - district 까지 봐야 갈리는 핵심 케이스
      const { oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({ price: 500 });
      const cartItemId = await addToCart(oneTimeToken, productVariantId, 1);

      // When
      const res = await preview(oneTimeToken, {
        cartItemIds: [cartItemId],
        city: '臺東縣',
        district: '臺東市',
      });

      // Then
      expect(res.body.data.isRemoteIsland).toBe(false);
      expect(res.body.data.shippingFee).toBe(60);
    });

    it('台東縣 처럼 台/臺 표기가 달라도 외섬 판정이 된다', async () => {
      // Given - 프론트 표기가 갈려도 요금을 덜 받으면 안 된다
      const { oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({ price: 500 });
      const cartItemId = await addToCart(oneTimeToken, productVariantId, 1);

      // When
      const res = await preview(oneTimeToken, {
        cartItemIds: [cartItemId],
        city: '台東縣',
        district: '綠島鄉',
      });

      // Then
      expect(res.body.data.isRemoteIsland).toBe(true);
      expect(res.body.data.shippingFee).toBe(100);
    });

    it('외섬 프로모션 중이면 澎湖縣 도 본섬 요율이 적용된다', async () => {
      // Given
      await setPolicy({ remoteIslandPromotion: true });
      const { oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({ price: 500 });
      const cartItemId = await addToCart(oneTimeToken, productVariantId, 1);

      // When
      const res = await preview(oneTimeToken, {
        cartItemIds: [cartItemId],
        city: '澎湖縣',
        district: '馬公市',
      });

      // Then - 외섬 판정 자체는 유지된다
      expect(res.body.data.isRemoteIsland).toBe(true);
      expect(res.body.data.shippingFee).toBe(60);
    });

    it('비활성화된 외섬 규칙은 판정에서 빠진다', async () => {
      // Given
      await dataSource.query(
        `UPDATE shipping_remote_area SET is_active = false WHERE city = '澎湖縣'`,
      );
      const { oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({ price: 500 });
      const cartItemId = await addToCart(oneTimeToken, productVariantId, 1);

      // When
      const res = await preview(oneTimeToken, {
        cartItemIds: [cartItemId],
        city: '澎湖縣',
        district: '馬公市',
      });

      // Then
      expect(res.body.data.isRemoteIsland).toBe(false);
      expect(res.body.data.shippingFee).toBe(60);
    });
  });

  // -------------------------------------------------------------------------
  describe('POST /user/order/preview — 무료배송', () => {
    it('임계금액 이상이면 외섬이라도 배송비가 0이다', async () => {
      // Given - 확정 정책: 무료배송은 본섬·외섬 구분이 없다
      const { oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({ price: 1200 });
      const cartItemId = await addToCart(oneTimeToken, productVariantId, 1);

      // When
      const res = await preview(oneTimeToken, {
        cartItemIds: [cartItemId],
        city: '澎湖縣',
        district: '馬公市',
      });

      // Then - 배송비는 0이지만 외섬 여부는 그대로 기록된다
      expect(res.body.data.isRemoteIsland).toBe(true);
      expect(res.body.data.shippingFee).toBe(0);
      expect(res.body.data.totalAmount).toBe(1200);
      expect(res.body.data.amountToFreeShipping).toBe(0);
    });

    it('선택하지 않은 라인은 금액에 들어가지 않는다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const first = await createVariant({ price: 500 });
      const second = await createVariant({ price: 900 });
      const firstId = await addToCart(oneTimeToken, first.productVariantId, 1);
      await addToCart(oneTimeToken, second.productVariantId, 1);

      // When - 첫 번째만 주문 대상으로 넘긴다
      const res = await preview(oneTimeToken, {
        cartItemIds: [firstId],
        ...MAIN_ISLAND,
      });

      // Then
      expect(res.body.data.totalProductAmount).toBe(500);
      expect(res.body.data.totalAmount).toBe(560);
    });

    it('남의 장바구니 라인을 섞으면 404를 반환한다', async () => {
      // Given
      const owner = await signUpAndLogin();
      const other = await signUpAndLogin();
      const { productVariantId } = await createVariant({ price: 500 });
      const cartItemId = await addToCart(owner.oneTimeToken, productVariantId);

      // When
      const res = await preview(other.oneTimeToken, {
        cartItemIds: [cartItemId],
        ...MAIN_ISLAND,
      });

      // Then
      expect(res.status).toBe(404);
    });

    it('DB에 주문을 만들지 않는다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({ price: 500 });
      const cartItemId = await addToCart(oneTimeToken, productVariantId);

      // When
      await preview(oneTimeToken, {
        cartItemIds: [cartItemId],
        ...MAIN_ISLAND,
      });

      // Then
      const rows = await dataSource.query(`SELECT id FROM "order"`);
      expect(rows).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('POST /user/order', () => {
    it('주문을 생성하고 스냅샷·주문번호를 남긴다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      await setUserProfile(userId);
      const { productItemId, productVariantId } = await createVariant({
        price: 500,
      });
      const cartItemId = await addToCart(oneTimeToken, productVariantId, 2);

      // When
      const res = await createOrder(oneTimeToken, {
        cartItemIds: [cartItemId],
        paymentMethod: 'LINE_PAY',
        useDefaultShipping: true,
      });

      // Then
      expect(res.status).toBe(201);
      expect(res.body.data.totalAmount).toBe(1060);
      expect(res.body.data.orderNumber).toMatch(/^SM-\d{8}-\d{6}$/);

      const orderRows = await dataSource.query(
        `SELECT status, total_product_amount, shipping_fee_applied,
                is_remote_island, free_shipping_threshold_snapshot, total_amount
           FROM "order" WHERE id = $1`,
        [res.body.data.orderId],
      );
      expect(orderRows[0].status).toBe('PENDING');
      expect(orderRows[0].total_product_amount).toBe(1000);
      expect(orderRows[0].shipping_fee_applied).toBe(60);
      expect(orderRows[0].is_remote_island).toBe(false);
      expect(orderRows[0].free_shipping_threshold_snapshot).toBe(1150);
      expect(orderRows[0].total_amount).toBe(1060);

      const itemRows = await dataSource.query(
        `SELECT product_item_id, quantity, unit_price, unit_discount_price, total_price, sku_snapshot
           FROM order_item WHERE order_id = $1`,
        [res.body.data.orderId],
      );
      expect(itemRows).toHaveLength(1);
      expect(itemRows[0].product_item_id).toBe(productItemId);
      expect(itemRows[0].quantity).toBe(2);
      expect(itemRows[0].total_price).toBe(1000);
      expect(itemRows[0].sku_snapshot).toBeTruthy();
    });

    it('주문 후에도 장바구니는 비워지지 않는다', async () => {
      // Given - 결제창에서 이탈했을 때 담아둔 것이 사라지면 안 된다
      const { userId, oneTimeToken } = await signUpAndLogin();
      await setUserProfile(userId);
      const { productVariantId } = await createVariant({ price: 500 });
      const cartItemId = await addToCart(oneTimeToken, productVariantId);

      // When
      const res = await createOrder(oneTimeToken, {
        cartItemIds: [cartItemId],
        paymentMethod: 'ECPAY',
        useDefaultShipping: true,
      });

      // Then
      expect(res.status).toBe(201);

      const rows = await dataSource.query(
        `SELECT id FROM cart_item WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(1);
    });

    it('기본 배송지를 order_shipping 에 복사한다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      await setUserProfile(userId);
      const { productVariantId } = await createVariant({ price: 500 });
      const cartItemId = await addToCart(oneTimeToken, productVariantId);

      // When
      const res = await createOrder(oneTimeToken, {
        cartItemIds: [cartItemId],
        paymentMethod: 'LINE_PAY',
        useDefaultShipping: true,
      });

      // Then
      const rows = await dataSource.query(
        `SELECT recipient_name, city, district, detail_address
           FROM order_shipping WHERE order_id = $1`,
        [res.body.data.orderId],
      );
      expect(rows[0].recipient_name).toBe('李佳蓉');
      expect(rows[0].city).toBe('臺北市');
      expect(rows[0].district).toBe('信義區');
    });

    it('직접 입력한 배송지의 지역으로 배송비를 계산한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({ price: 500 });
      const cartItemId = await addToCart(oneTimeToken, productVariantId);

      // When
      const res = await createOrder(oneTimeToken, {
        cartItemIds: [cartItemId],
        paymentMethod: 'LINE_PAY',
        useDefaultShipping: false,
        shipping: {
          recipientName: '王小明',
          phone: '+886912345678',
          postalCode: '880',
          city: '澎湖縣',
          district: '馬公市',
          detailAddress: '中正路 1號',
        },
      });

      // Then
      expect(res.status).toBe(201);
      expect(res.body.data.totalAmount).toBe(600);

      const rows = await dataSource.query(
        `SELECT is_remote_island, shipping_fee_applied FROM "order" WHERE id = $1`,
        [res.body.data.orderId],
      );
      expect(rows[0].is_remote_island).toBe(true);
      expect(rows[0].shipping_fee_applied).toBe(100);
    });

    it('기본 배송지를 쓰는데 프로필 주소가 비어 있으면 400을 반환한다', async () => {
      // Given - 프로필을 만들지 않는다
      const { oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({ price: 500 });
      const cartItemId = await addToCart(oneTimeToken, productVariantId);

      // When
      const res = await createOrder(oneTimeToken, {
        cartItemIds: [cartItemId],
        paymentMethod: 'LINE_PAY',
        useDefaultShipping: true,
      });

      // Then
      expect(res.status).toBe(400);
    });

    it('useDefaultShipping=false 인데 shipping 이 없으면 400을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const { productVariantId } = await createVariant({ price: 500 });
      const cartItemId = await addToCart(oneTimeToken, productVariantId);

      // When
      const res = await createOrder(oneTimeToken, {
        cartItemIds: [cartItemId],
        paymentMethod: 'LINE_PAY',
        useDefaultShipping: false,
      });

      // Then
      expect(res.status).toBe(400);
    });

    it('담은 뒤 재고가 줄어 부족해지면 409를 반환한다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      await setUserProfile(userId);
      const { productVariantId } = await createVariant({
        price: 500,
        stockQuantity: 5,
      });
      const cartItemId = await addToCart(oneTimeToken, productVariantId, 3);

      await dataSource.query(
        `UPDATE product_variant SET stock_quantity = 1 WHERE id = $1`,
        [productVariantId],
      );

      // When
      const res = await createOrder(oneTimeToken, {
        cartItemIds: [cartItemId],
        paymentMethod: 'LINE_PAY',
        useDefaultShipping: true,
      });

      // Then
      expect(res.status).toBe(409);

      const rows = await dataSource.query(`SELECT id FROM "order"`);
      expect(rows).toHaveLength(0);
    });

    it('재고를 차감하지 않는다', async () => {
      // Given - 차감은 결제 확정 단계의 일이다
      const { userId, oneTimeToken } = await signUpAndLogin();
      await setUserProfile(userId);
      const { productVariantId } = await createVariant({
        price: 500,
        stockQuantity: 10,
      });
      const cartItemId = await addToCart(oneTimeToken, productVariantId, 3);

      // When
      await createOrder(oneTimeToken, {
        cartItemIds: [cartItemId],
        paymentMethod: 'LINE_PAY',
        useDefaultShipping: true,
      });

      // Then
      const rows = await dataSource.query(
        `SELECT stock_quantity FROM product_variant WHERE id = $1`,
        [productVariantId],
      );
      expect(rows[0].stock_quantity).toBe(10);
    });

    it('preview 금액과 실제 주문 금액이 일치한다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      await setUserProfile(userId, '澎湖縣');
      const { productVariantId } = await createVariant({ price: 700 });
      const cartItemId = await addToCart(oneTimeToken, productVariantId, 1);

      // When
      const previewRes = await preview(oneTimeToken, {
        cartItemIds: [cartItemId],
        city: '澎湖縣',
        district: '信義區',
      });
      const orderRes = await createOrder(oneTimeToken, {
        cartItemIds: [cartItemId],
        paymentMethod: 'LINE_PAY',
        useDefaultShipping: true,
      });

      // Then
      expect(orderRes.body.data.totalAmount).toBe(
        previewRes.body.data.totalAmount,
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('스냅샷 불변성', () => {
    it('배송비 정책을 바꿔도 기존 주문의 금액은 변하지 않는다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      await setUserProfile(userId);
      const { productVariantId } = await createVariant({ price: 500 });
      const cartItemId = await addToCart(oneTimeToken, productVariantId);

      const orderRes = await createOrder(oneTimeToken, {
        cartItemIds: [cartItemId],
        paymentMethod: 'LINE_PAY',
        useDefaultShipping: true,
      });
      const orderId = orderRes.body.data.orderId;

      // When - 요율과 임계금액을 전부 바꾼다
      await setPolicy({
        baseFee: 999,
        remoteIslandFee: 999,
        freeShippingThreshold: 1,
      });

      // Then - 스냅샷이라 주문 금액은 그대로다
      const rows = await dataSource.query(
        `SELECT shipping_fee_applied, free_shipping_threshold_snapshot, total_amount
           FROM "order" WHERE id = $1`,
        [orderId],
      );
      expect(rows[0].shipping_fee_applied).toBe(60);
      expect(rows[0].free_shipping_threshold_snapshot).toBe(1150);
      expect(rows[0].total_amount).toBe(560);

      const detail = await request(app.getHttpServer())
        .get(`${ORDER_BASE}/${orderId}`)
        .set('Authorization', `Bearer ${oneTimeToken}`);
      expect(detail.body.data.totalAmount).toBe(560);
    });

    it('상품이 삭제돼도 주문 라인은 스냅샷으로 남는다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      await setUserProfile(userId);
      const { productItemId, productVariantId } = await createVariant({
        price: 500,
      });
      const cartItemId = await addToCart(oneTimeToken, productVariantId);

      const orderRes = await createOrder(oneTimeToken, {
        cartItemIds: [cartItemId],
        paymentMethod: 'LINE_PAY',
        useDefaultShipping: true,
      });

      // When - 상품 아이템을 물리 삭제하면 variant 도 CASCADE 로 사라진다
      await dataSource.query(`DELETE FROM product_item WHERE id = $1`, [
        productItemId,
      ]);

      // Then - 주문 라인은 남고 스냅샷만으로 상세를 그릴 수 있다.
      // (운영에서는 FK 의 ON DELETE SET NULL 로 product_variant_id 가 NULL 이 되지만,
      //  테스트 환경은 createForeignKeyConstraints 가 false 라 FK 자체가 없다.
      //  여기서 검증할 것은 "스냅샷만으로 주문 내역이 온전한가" 이다)
      const rows = await dataSource.query(
        `SELECT sku_snapshot, product_name_snapshot, option_text_snapshot, total_price
           FROM order_item WHERE order_id = $1`,
        [orderRes.body.data.orderId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].sku_snapshot).toBeTruthy();
      expect(rows[0].total_price).toBe(500);

      const detail = await request(app.getHttpServer())
        .get(`${ORDER_BASE}/${orderRes.body.data.orderId}`)
        .set('Authorization', `Bearer ${oneTimeToken}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.items[0].totalPrice).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  describe('GET /user/order/:id', () => {
    it('주문 상세를 반환한다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      await setUserProfile(userId);
      const { productVariantId } = await createVariant({ price: 500 });
      const cartItemId = await addToCart(oneTimeToken, productVariantId, 2);

      const orderRes = await createOrder(oneTimeToken, {
        cartItemIds: [cartItemId],
        paymentMethod: 'LINE_PAY',
        useDefaultShipping: true,
      });

      // When
      const res = await request(app.getHttpServer())
        .get(`${ORDER_BASE}/${orderRes.body.data.orderId}`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.paymentMethod).toBe('LINE_PAY');
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].quantity).toBe(2);
      expect(res.body.data.shipping.city).toBe('臺北市');
    });

    it('남의 주문은 404를 반환한다', async () => {
      // Given
      const owner = await signUpAndLogin();
      const other = await signUpAndLogin();
      await setUserProfile(owner.userId);
      const { productVariantId } = await createVariant({ price: 500 });
      const cartItemId = await addToCart(owner.oneTimeToken, productVariantId);

      const orderRes = await createOrder(owner.oneTimeToken, {
        cartItemIds: [cartItemId],
        paymentMethod: 'LINE_PAY',
        useDefaultShipping: true,
      });

      // When
      const res = await request(app.getHttpServer())
        .get(`${ORDER_BASE}/${orderRes.body.data.orderId}`)
        .set('Authorization', `Bearer ${other.oneTimeToken}`);

      // Then
      expect(res.status).toBe(404);
    });
  });
});

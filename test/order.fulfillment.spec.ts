import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { clearTokenCache, getAdminToken } from './setup/auth.helper';
import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

const USER_AUTH_BASE = '/user/auth';
const CART_BASE = '/user/cart';
const ORDER_BASE = '/user/order';
const ADMIN_ORDER_BASE = '/admin/order';

const MAIN_ISLAND = { city: '臺北市', district: '信義區' };
const HOUR = 3600;

describe('주문 현황·발주 (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;

  beforeAll(async () => {
    app = await getTestApp();
    dataSource = getDataSource(app);
    clearTokenCache();
    adminToken = await getAdminToken(app);
  }, 60_000);

  beforeEach(async () => {
    await setPolicy({ enabled: true, threshold: 4000 });
  });

  afterEach(async () => {
    await truncateTables(dataSource, [
      'order_event',
      'shipment_order',
      'shipment',
      'payment_event',
      'payment',
      'order_invoice',
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
  async function setPolicy(options: { enabled: boolean; threshold: number }) {
    await dataSource.query(`DELETE FROM shipping_policy WHERE id = 1`);
    await dataSource.query(
      `INSERT INTO shipping_policy
         (id, base_fee, remote_island_fee, remote_island_promotion,
          free_shipping_threshold, international_discount_enabled)
       VALUES (1, 60, 100, false, $1, $2)`,
      [options.threshold, options.enabled],
    );
  }

  async function signUpAndLogin(): Promise<{ userId: number; token: string }> {
    const body = {
      email: faker.internet.email().toLowerCase(),
      password: faker.internet.password({ length: 12 }),
      nickname: faker.internet
        .username()
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 20),
    };

    await request(app.getHttpServer())
      .post(`${USER_AUTH_BASE}/signup`)
      .send(body)
      .expect(204);
    const loginRes = await request(app.getHttpServer())
      .post(`${USER_AUTH_BASE}/login`)
      .send({ email: body.email, password: body.password })
      .expect(200);
    const rows = await dataSource.query(
      `SELECT id FROM "user" WHERE email = $1`,
      [body.email],
    );

    await dataSource.query(
      `INSERT INTO user_profile (user_id, name, postal_code, city, district, detail_address)
       VALUES ($1, '李佳蓉', '110', '臺北市', '信義區', '松高路 11號 5樓')`,
      [rows[0].id],
    );
    await dataSource.query(`UPDATE "user" SET phone = $1 WHERE id = $2`, [
      `+886${faker.string.numeric(9)}`,
      rows[0].id,
    ]);

    return { userId: rows[0].id, token: loginRes.body.data.token as string };
  }

  async function createVariant(price: number): Promise<number> {
    const category = await dataSource.query(
      `INSERT INTO category (sort_order) VALUES (1) RETURNING id`,
    );
    const brand = await dataSource.query(
      `INSERT INTO brand (category_id, english_name) VALUES ($1, $2) RETURNING id`,
      [category[0].id, faker.company.name()],
    );
    const product = await dataSource.query(
      `INSERT INTO product (brand_id, category_id) VALUES ($1, $2) RETURNING id`,
      [brand[0].id, category[0].id],
    );
    const item = await dataSource.query(
      `INSERT INTO product_item (product_id, price, status)
       VALUES ($1, $2, 'NORMAL') RETURNING id`,
      [product[0].id, price],
    );
    const variant = await dataSource.query(
      `INSERT INTO product_variant (product_item_id, sku, stock_quantity, status)
       VALUES ($1, $2, 100, 'ACTIVE') RETURNING id`,
      [item[0].id, faker.string.alphanumeric(12).toUpperCase()],
    );

    return variant[0].id;
  }

  async function addToCart(token: string, variantId: number): Promise<number> {
    const res = await request(app.getHttpServer())
      .post(CART_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productVariantId: variantId, quantity: 1 }] })
      .expect(201);

    return res.body.data.items[0].cartItemId;
  }

  function preview(token: string, cartItemId: number, area = MAIN_ISLAND) {
    return request(app.getHttpServer())
      .post(`${ORDER_BASE}/preview`)
      .set('Authorization', `Bearer ${token}`)
      .set('Accept-language', 'ko')
      .send({ cartItemIds: [cartItemId], ...area });
  }

  /** 주문을 만들고(기본 상품 1개) DB 에서 결제 완료 상태로 만든다 */
  async function placeOrder(
    token: string,
    options?: { price?: number; paidHoursAgo?: number | null; lines?: number },
  ): Promise<number> {
    const cartItemIds: number[] = [];

    for (let i = 0; i < (options?.lines ?? 1); i++) {
      const variantId = await createVariant(options?.price ?? 1000);

      cartItemIds.push(await addToCart(token, variantId));
    }

    const res = await request(app.getHttpServer())
      .post(ORDER_BASE)
      .set('Authorization', `Bearer ${token}`)
      .set('Accept-language', 'ko')
      .send({
        cartItemIds,
        paymentMethod: 'LINE_PAY',
        useDefaultShipping: true,
      })
      .expect(201);
    const orderId = res.body.data.orderId as number;

    if (options?.paidHoursAgo !== null) {
      await dataSource.query(
        `UPDATE "order"
            SET status = 'PAID',
                paid_at = NOW() - make_interval(secs => $2)
          WHERE id = $1`,
        [orderId, (options?.paidHoursAgo ?? 0) * HOUR],
      );
    }

    return orderId;
  }

  function adminGet(path: string, language?: string) {
    const req = request(app.getHttpServer())
      .get(`${ADMIN_ORDER_BASE}${path}`)
      .set('Authorization', `Bearer ${adminToken}`);

    return language ? req.set('Accept-language', language) : req;
  }

  function adminPurchase(orderId: number, body: Record<string, unknown> = {}) {
    return request(app.getHttpServer())
      .post(`${ADMIN_ORDER_BASE}/${orderId}/purchase`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);
  }

  // -------------------------------------------------------------------------
  describe('국제배송비 지원 할인 — 구간 경계', () => {
    const cases: Array<[number, number, number]> = [
      // [상품 금액, 할인, 최종 결제(본섬)]
      [3999, 0, 4059],
      [4000, 120, 3880],
      [4999, 120, 4879],
      [5000, 250, 4750],
      [7999, 250, 7749],
      [8000, 450, 7550],
      [11999, 450, 11549],
      [12000, 700, 11300],
    ];

    it.each(cases)(
      '상품 NT$%i 는 할인 NT$%i, 결제 NT$%i 이다',
      async (price, discount, total) => {
        // Given
        const { token } = await signUpAndLogin();
        const cartItemId = await addToCart(token, await createVariant(price));

        // When
        const res = await preview(token, cartItemId);

        // Then
        expect(res.status).toBe(200);
        expect(res.body.data.internationalDiscount).toBe(discount);
        expect(res.body.data.totalAmount).toBe(total);
      },
    );

    it('NT$4,000 이상은 외곽 섬도 국내배송비가 0이다', async () => {
      // Given
      await dataSource.query(
        `INSERT INTO shipping_remote_area (city, district, is_active)
         VALUES ('澎湖縣', NULL, true)`,
      );
      const { token } = await signUpAndLogin();
      const cartItemId = await addToCart(token, await createVariant(4000));

      // When
      const res = await preview(token, cartItemId, {
        city: '澎湖縣',
        district: '馬公市',
      });

      // Then
      expect(res.body.data.shippingFee).toBe(0);
      expect(res.body.data.totalAmount).toBe(3880);
    });

    it('NT$3,999 외곽 섬은 할인 없이 배송비 NT$100 이다', async () => {
      // Given
      await dataSource.query(
        `INSERT INTO shipping_remote_area (city, district, is_active)
         VALUES ('澎湖縣', NULL, true)`,
      );
      const { token } = await signUpAndLogin();
      const cartItemId = await addToCart(token, await createVariant(3999));

      // When
      const res = await preview(token, cartItemId, {
        city: '澎湖縣',
        district: '馬公市',
      });

      // Then
      expect(res.body.data.internationalDiscount).toBe(0);
      expect(res.body.data.totalAmount).toBe(4099);
    });

    it('다음 구간과 남은 금액을 알려 준다 (2,640 → 4,000 까지 1,360)', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const cartItemId = await addToCart(token, await createVariant(2640));

      // When
      const res = await preview(token, cartItemId);

      // Then
      expect(res.body.data.nextDiscountThreshold).toBe(4000);
      expect(res.body.data.nextDiscountAmount).toBe(120);
      expect(res.body.data.amountToNextDiscount).toBe(1360);
      expect(res.body.data.totalAmount).toBe(2700);
    });

    it('스위치가 꺼져 있으면 할인이 없고 다음 구간도 없다', async () => {
      // Given
      await setPolicy({ enabled: false, threshold: 4000 });
      const { token } = await signUpAndLogin();
      const cartItemId = await addToCart(token, await createVariant(5000));

      // When
      const res = await preview(token, cartItemId);

      // Then
      expect(res.body.data.internationalDiscount).toBe(0);
      expect(res.body.data.nextDiscountThreshold).toBeNull();
      expect(res.body.data.totalAmount).toBe(5000);
    });

    it('주문 생성 때 할인액이 스냅샷으로 저장된다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const orderId = await placeOrder(token, {
        price: 5000,
        paidHoursAgo: null,
      });

      // When
      const res = await request(app.getHttpServer())
        .get(`${ORDER_BASE}/${orderId}`)
        .set('Authorization', `Bearer ${token}`);

      // Then
      expect(res.body.data.internationalDiscount).toBe(250);
      expect(res.body.data.totalAmount).toBe(4750);

      // When - 정책을 꺼도 과거 주문은 그대로
      await setPolicy({ enabled: false, threshold: 4000 });
      const again = await request(app.getHttpServer())
        .get(`${ORDER_BASE}/${orderId}`)
        .set('Authorization', `Bearer ${token}`);

      // Then
      expect(again.body.data.internationalDiscount).toBe(250);
    });

    it('관리자가 정책 PATCH 로 스위치를 켜고 끌 수 있다', async () => {
      // Given
      await setPolicy({ enabled: false, threshold: 4000 });

      // When
      await request(app.getHttpServer())
        .patch('/admin/shipping/policy')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ internationalDiscountEnabled: true })
        .expect(204);
      const res = await request(app.getHttpServer())
        .get('/admin/shipping/policy')
        .set('Authorization', `Bearer ${adminToken}`);

      // Then
      expect(res.body.data.internationalDiscountEnabled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('GET /user/order — 내 주문 목록', () => {
    it('결제 전(PENDING) 주문은 나오지 않고, 최신순으로 나온다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const first = await placeOrder(token, { paidHoursAgo: 1 });
      const second = await placeOrder(token, { paidHoursAgo: 0 });
      await placeOrder(token, { paidHoursAgo: null });

      // When
      const res = await request(app.getHttpServer())
        .get(ORDER_BASE)
        .set('Authorization', `Bearer ${token}`)
        .set('Accept-language', 'zh-TW');

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.list.map((o: any) => o.orderId)).toEqual([
        second,
        first,
      ]);
      expect(res.body.data.list[0]).toMatchObject({
        status: 'PAID',
        statusLabel: '已付款',
        deliveryStage: 'ORDER_CONFIRMED',
        deliveryStageLabel: '訂單確認',
        deliveryStep: 1,
        itemCount: 1,
      });
    });

    it('Accept-Language 가 없으면 한국어 문구로 내려간다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      await placeOrder(token, { paidHoursAgo: 0 });

      // When
      const res = await request(app.getHttpServer())
        .get(ORDER_BASE)
        .set('Authorization', `Bearer ${token}`);

      // Then
      expect(res.body.data.list[0].deliveryStageLabel).toBe('주문 확인');
    });

    it('status 필터: 진행 중 / 완료 / 취소가 갈린다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const inProgress = await placeOrder(token, { paidHoursAgo: 0 });
      const done = await placeOrder(token, { paidHoursAgo: 0 });
      const canceled = await placeOrder(token, { paidHoursAgo: null });
      await dataSource.query(
        `UPDATE "order" SET delivery_stage = 'DELIVERED' WHERE id = $1`,
        [done],
      );
      await dataSource.query(
        `UPDATE "order" SET status = 'CANCELED' WHERE id = $1`,
        [canceled],
      );
      const ids = async (status: string) =>
        (
          await request(app.getHttpServer())
            .get(`${ORDER_BASE}?status=${status}`)
            .set('Authorization', `Bearer ${token}`)
        ).body.data.list.map((o: any) => o.orderId);

      // When / Then
      expect(await ids('IN_PROGRESS')).toEqual([inProgress]);
      expect(await ids('COMPLETED')).toEqual([done]);
      expect(await ids('CANCELED')).toEqual([canceled]);
      expect((await ids('ALL')).length).toBe(3);
    });

    it('다른 사람의 주문은 목록에도 상세에도 나오지 않는다', async () => {
      // Given
      const owner = await signUpAndLogin();
      const other = await signUpAndLogin();
      const orderId = await placeOrder(owner.token, { paidHoursAgo: 0 });

      // When
      const list = await request(app.getHttpServer())
        .get(ORDER_BASE)
        .set('Authorization', `Bearer ${other.token}`);
      const detail = await request(app.getHttpServer())
        .get(`${ORDER_BASE}/${orderId}`)
        .set('Authorization', `Bearer ${other.token}`);

      // Then
      expect(list.body.data.total).toBe(0);
      expect(detail.status).toBe(404);
    });

    it('페이지네이션이 total 을 유지한다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      await placeOrder(token, { paidHoursAgo: 0 });
      await placeOrder(token, { paidHoursAgo: 0 });
      await placeOrder(token, { paidHoursAgo: 0 });

      // When
      const res = await request(app.getHttpServer())
        .get(`${ORDER_BASE}?count=2&page=2`)
        .set('Authorization', `Bearer ${token}`);

      // Then
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.list).toHaveLength(1);
    });

    it('상품이 여러 개인 주문도 페이지 크기는 주문 수로 센다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const ids = [
        await placeOrder(token, { paidHoursAgo: 0, lines: 2 }),
        await placeOrder(token, { paidHoursAgo: 0, lines: 2 }),
        await placeOrder(token, { paidHoursAgo: 0, lines: 2 }),
      ];
      const getPage = (page: number) =>
        request(app.getHttpServer())
          .get(`${ORDER_BASE}?count=2&page=${page}`)
          .set('Authorization', `Bearer ${token}`);

      // When
      const first = await getPage(1);
      const second = await getPage(2);

      // Then
      expect(first.body.data.total).toBe(3);
      expect(first.body.data.list.map((o: any) => o.orderId)).toEqual([
        ids[2],
        ids[1],
      ]);
      expect(second.body.data.list.map((o: any) => o.orderId)).toEqual([
        ids[0],
      ]);
      expect(first.body.data.list[0].itemCount).toBe(2);
    });

    it('로그인하지 않으면 401 이다', async () => {
      const res = await request(app.getHttpServer()).get(ORDER_BASE);

      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  describe('ADMIN 24시간 타이머 · 주문 목록 · KPI', () => {
    it('결제 후 24시간 경계: 23:59:59 는 대기(SOON), 24:00:00 은 발주 가능', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const before = await placeOrder(token, { paidHoursAgo: 0 });
      const after = await placeOrder(token, { paidHoursAgo: 0 });
      await dataSource.query(
        `UPDATE "order" SET paid_at = NOW() - interval '23 hours 59 minutes 59 seconds' WHERE id = $1`,
        [before],
      );
      await dataSource.query(
        `UPDATE "order" SET paid_at = NOW() - interval '24 hours 10 seconds' WHERE id = $1`,
        [after],
      );

      // When
      const res = await adminGet('?chip=ALL', 'ko');

      // Then
      const byId = new Map<number, any>(
        res.body.data.list.map((o: any) => [o.orderId, o]),
      );
      expect(byId.get(before)).toMatchObject({
        timerState: 'SOON',
        canStartPurchase: false,
      });
      expect(byId.get(after)).toMatchObject({
        timerState: 'READY',
        canStartPurchase: true,
        timerStateLabel: '24시간 경과 · 발주 가능',
        remainingSeconds: 0,
      });
    });

    it('KPI 와 chip 필터가 같은 기준으로 센다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const waiting = await placeOrder(token, { paidHoursAgo: 2 });
      const ready = await placeOrder(token, { paidHoursAgo: 30 });
      const canceled = await placeOrder(token, { paidHoursAgo: 30 });
      await dataSource.query(
        `UPDATE "order" SET cancellation_requested_at = NOW() WHERE id = $1`,
        [canceled],
      );

      // When
      const summary = await adminGet('/summary');
      const readyList = await adminGet('?chip=READY');
      const waitingList = await adminGet('?chip=WAITING');
      const cancelList = await adminGet('?chip=CANCEL_REQUESTED');

      // Then
      expect(summary.status).toBe(200);
      expect(summary.body.data).toMatchObject({
        waiting: 1,
        ready: 1,
        cancelRequested: 1,
      });
      expect(readyList.body.data.list.map((o: any) => o.orderId)).toEqual([
        ready,
      ]);
      expect(waitingList.body.data.list.map((o: any) => o.orderId)).toEqual([
        waiting,
      ]);
      expect(cancelList.body.data.list[0]).toMatchObject({
        orderId: canceled,
        timerState: 'CANCEL_REQUESTED',
        canStartPurchase: false,
      });
    });

    it('주문번호·받는 분·상품명으로 검색한다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const orderId = await placeOrder(token, { paidHoursAgo: 1 });
      const [row] = await dataSource.query(
        `SELECT order_number FROM "order" WHERE id = $1`,
        [orderId],
      );

      // When
      const byNumber = await adminGet(`?search=${row.order_number}`);
      const byName = await adminGet(`?search=${encodeURIComponent('李佳')}`);
      const none = await adminGet('?search=zzzzzz');

      // Then
      expect(byNumber.body.data.total).toBe(1);
      expect(byName.body.data.total).toBe(1);
      expect(none.body.data.total).toBe(0);
    });

    it('없는 날짜·0쪽 같은 잘못된 입력은 500 이 아니라 400 이다', async () => {
      // When
      const badDate = await adminGet('?paidFrom=2026-13-45');
      const badPage = await adminGet('?page=0');
      const bigCount = await adminGet('?count=100000');

      // Then
      expect(badDate.status).toBe(400);
      expect(badPage.status).toBe(400);
      expect(bigCount.status).toBe(400);
    });

    it('관리자 토큰이 없거나 회원 토큰이면 401 이다', async () => {
      // Given
      const { token } = await signUpAndLogin();

      // When
      const noToken = await request(app.getHttpServer()).get(ADMIN_ORDER_BASE);
      const userToken = await request(app.getHttpServer())
        .get(ADMIN_ORDER_BASE)
        .set('Authorization', `Bearer ${token}`);

      // Then
      expect(noToken.status).toBe(401);
      expect(userToken.status).toBe(401);
    });

    it('상세(드로어)에 주문·발주·타이머가 같이 내려간다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const orderId = await placeOrder(token, { paidHoursAgo: 30 });

      // When
      const res = await adminGet(`/${orderId}`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.order.orderId).toBe(orderId);
      expect(res.body.data.purchase.purchaseStatus).toBe('NOT_ORDERED');
      expect(res.body.data.timer.timerState).toBe('READY');
    });

    it('상세의 발표 정보는 고객 주문 상세와 같다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const orderId = await placeOrder(token, { paidHoursAgo: 30 });
      const mine = await request(app.getHttpServer())
        .get(`${ORDER_BASE}/${orderId}`)
        .set('Authorization', `Bearer ${token}`);

      // When
      const res = await adminGet(`/${orderId}`);

      // Then
      expect(mine.body.data.invoice).not.toBeNull();
      expect(res.body.data.order.invoice).toEqual(mine.body.data.invoice);
    });
  });

  // -------------------------------------------------------------------------
  describe('POST /admin/order/:id/purchase — 한국 발주 시작', () => {
    it('24시간이 지났으면 발주되고 배송 단계가 상품 준비 중이 된다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const orderId = await placeOrder(token, { paidHoursAgo: 25 });

      // When
      const res = await adminPurchase(orderId, { supplierOrderNo: 'KR-1' });

      // Then
      expect(res.status).toBe(204);
      const [row] = await dataSource.query(
        `SELECT purchase_status, delivery_stage, supplier_order_no,
                purchase_override_reason, purchased_by_admin_id, supplier_ordered_at
           FROM "order" WHERE id = $1`,
        [orderId],
      );
      expect(row).toMatchObject({
        purchase_status: 'ORDERED',
        delivery_stage: 'PREPARING_ORDER',
        supplier_order_no: 'KR-1',
        purchase_override_reason: null,
      });
      expect(row.purchased_by_admin_id).toEqual(expect.any(Number));
      expect(row.supplier_ordered_at).not.toBeNull();
    });

    it('같은 주문을 두 번 발주할 수 없다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const orderId = await placeOrder(token, { paidHoursAgo: 25 });
      await adminPurchase(orderId).expect(204);

      // When
      const res = await adminPurchase(orderId);

      // Then
      expect(res.status).toBe(409);
    });

    it('동시에 두 번 눌러도 한 번만 발주된다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const orderId = await placeOrder(token, { paidHoursAgo: 25 });

      // When
      const results = await Promise.all([
        adminPurchase(orderId),
        adminPurchase(orderId),
      ]);

      // Then
      expect(results.map((r) => r.status).sort()).toEqual([204, 409]);
    });

    it('24시간 전에는 사유 없이 발주할 수 없고, 사유가 있으면 조기 발주로 기록된다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const orderId = await placeOrder(token, { paidHoursAgo: 2 });

      // When
      const noReason = await adminPurchase(orderId);
      const withReason = await adminPurchase(orderId, {
        earlyReason: '재고 소진 임박',
      });

      // Then
      expect(noReason.status).toBe(400);
      expect(withReason.status).toBe(204);
      const [row] = await dataSource.query(
        `SELECT purchase_override_reason FROM "order" WHERE id = $1`,
        [orderId],
      );
      expect(row.purchase_override_reason).toBe('재고 소진 임박');
    });

    it('취소 통지가 접수된 주문은 24시간이 지나도 발주할 수 없다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const orderId = await placeOrder(token, { paidHoursAgo: 48 });
      await dataSource.query(
        `UPDATE "order" SET cancellation_requested_at = NOW() WHERE id = $1`,
        [orderId],
      );

      // When
      const res = await adminPurchase(orderId, {
        earlyReason: '무시되어야 함',
      });

      // Then
      expect(res.status).toBe(409);
    });

    it('결제가 안 된 주문은 발주할 수 없다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const orderId = await placeOrder(token, { paidHoursAgo: null });

      // When
      const res = await adminPurchase(orderId);

      // Then
      expect(res.status).toBe(409);
    });

    it('없는 주문은 404 이다', async () => {
      const res = await adminPurchase(999999);

      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  function userGetOrder(token: string, orderId: number) {
    return request(app.getHttpServer())
      .get(`${ORDER_BASE}/${orderId}`)
      .set('Authorization', `Bearer ${token}`);
  }

  function cancelRequest(token: string, orderId: number, reason?: string) {
    return request(app.getHttpServer())
      .post(`${ORDER_BASE}/${orderId}/cancel-request`)
      .set('Authorization', `Bearer ${token}`)
      .send(reason === undefined ? {} : { reason });
  }

  function adminSend(
    method: 'post' | 'patch' | 'delete',
    path: string,
    body: Record<string, unknown> = {},
  ) {
    return request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);
  }

  function changeStage(orderIds: number[], extra: Record<string, unknown>) {
    return adminSend('post', `${ADMIN_ORDER_BASE}/delivery-stage`, {
      orderIds,
      ...extra,
    });
  }

  describe('POST /user/order/:id/cancel-request — 취소·계약해제 접수', () => {
    it('접수하면 통지 시각이 남고 관리자 KPI·칩·발주 차단에 반영된다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const orderId = await placeOrder(token, { paidHoursAgo: 48 });

      // When
      const res = await cancelRequest(token, orderId, '  사이즈 오류  ');

      // Then
      expect(res.status).toBe(204);
      const detail = (await userGetOrder(token, orderId)).body.data;
      expect(detail.cancellationRequestedAt).not.toBeNull();
      expect(detail.canRequestCancel).toBe(false);

      const summary = (await adminGet('/summary')).body.data;
      expect(summary.cancelRequested).toBe(1);
      expect(summary.ready).toBe(0);

      const list = (await adminGet('?chip=CANCEL_REQUESTED')).body;
      expect(list.data.list.map((x: any) => x.orderId)).toEqual([orderId]);
      expect(list.data.list[0].timerState).toBe('CANCEL_REQUESTED');
      expect((await adminPurchase(orderId)).status).toBe(409);

      const admin = (await adminGet(`/${orderId}`)).body.data;
      expect(admin.cancellation.reason).toBe('사이즈 오류');
      expect(admin.cancellation.withinQuickCancelPeriod).toBe(false);
      expect(admin.events[0]).toMatchObject({
        type: 'CANCEL_REQUESTED',
        adminId: null,
        message: '사이즈 오류',
      });
    });

    it('24시간이 지나고 발주·배송 완료된 주문도 접수된다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const orderId = await placeOrder(token, { paidHoursAgo: 240 });
      await adminPurchase(orderId).expect(204);
      await changeStage([orderId], { deliveryStage: 'DELIVERED' }).expect(204);

      // When
      const before = (await userGetOrder(token, orderId)).body.data;
      const res = await cancelRequest(token, orderId);

      // Then
      expect(before.canRequestCancel).toBe(true);
      expect(before.isQuickCancelPeriod).toBe(false);
      expect(res.status).toBe(204);
      const admin = (await adminGet(`/${orderId}`)).body.data;
      expect(admin.cancellation.requestedAt).not.toBeNull();
      expect(admin.cancellation.reason).toBeNull();
    });

    it('결제 후 24시간 안이면 간편취소 구간으로 표시된다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const orderId = await placeOrder(token, { paidHoursAgo: 1 });

      // When
      const before = (await userGetOrder(token, orderId)).body.data;
      await cancelRequest(token, orderId).expect(204);

      // Then
      expect(before.isQuickCancelPeriod).toBe(true);
      expect(before.quickCancelUntil).not.toBeNull();
      const admin = (await adminGet(`/${orderId}`)).body.data;
      expect(admin.cancellation.withinQuickCancelPeriod).toBe(true);
    });

    it('두 번 접수해도 처음 통지 시각과 사유가 유지된다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const orderId = await placeOrder(token);
      await cancelRequest(token, orderId, '처음').expect(204);
      const first = (await userGetOrder(token, orderId)).body.data;

      // When
      const res = await cancelRequest(token, orderId, '두 번째');

      // Then
      expect(res.status).toBe(204);
      const admin = (await adminGet(`/${orderId}`)).body.data;
      expect(admin.cancellation.reason).toBe('처음');
      expect(admin.cancellation.requestedAt).toBe(
        first.cancellationRequestedAt,
      );
      expect(admin.events).toHaveLength(1);
    });

    it('결제 전 주문은 409, 남의 주문은 404, 비로그인은 401 이다', async () => {
      // Given
      const mine = await signUpAndLogin();
      const other = await signUpAndLogin();
      const pending = await placeOrder(mine.token, { paidHoursAgo: null });
      const others = await placeOrder(other.token);

      // When / Then
      expect((await cancelRequest(mine.token, pending)).status).toBe(409);
      expect((await cancelRequest(mine.token, others)).status).toBe(404);
      expect(
        (
          await request(app.getHttpServer()).post(
            `${ORDER_BASE}/${others}/cancel-request`,
          )
        ).status,
      ).toBe(401);
      expect(
        (await cancelRequest(mine.token, others, 'x'.repeat(501))).status,
      ).toBe(400);
    });

    it('관리자가 접수를 철회하면 다시 발주할 수 있고 이력이 남는다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const orderId = await placeOrder(token, { paidHoursAgo: 48 });
      await cancelRequest(token, orderId, '변심').expect(204);
      const path = `${ADMIN_ORDER_BASE}/${orderId}/cancel-request`;

      // When
      const res = await adminSend('delete', path);

      // Then
      expect(res.status).toBe(204);
      expect((await adminSend('delete', path)).status).toBe(409);
      expect((await userGetOrder(token, orderId)).body.data).toMatchObject({
        cancellationRequestedAt: null,
        canRequestCancel: true,
      });
      expect((await adminPurchase(orderId)).status).toBe(204);
      const admin = (await adminGet(`/${orderId}`)).body.data;
      expect(admin.events.map((x: any) => x.type)).toEqual([
        'PURCHASED',
        'CANCEL_REQUEST_WITHDRAWN',
        'CANCEL_REQUESTED',
      ]);
      expect(admin.events[1].message).toBe('변심');
    });
  });

  describe('POST /admin/order/delivery-stage — 배송 단계 변경', () => {
    it('여러 주문을 한 번에 바꾸고 고객 주문조회에 반영된다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const first = await placeOrder(token);
      const second = await placeOrder(token);

      // When
      const res = await changeStage([first, second, first], {
        deliveryStage: 'INTERNATIONAL_SHIPPING',
      });

      // Then
      expect(res.status).toBe(204);
      for (const orderId of [first, second]) {
        const detail = (await userGetOrder(token, orderId)).body.data;

        expect(detail.deliveryStage).toBe('INTERNATIONAL_SHIPPING');
        expect(detail.deliveryStep).toBe(3);
        expect(detail.deliveredAt).toBeNull();
      }
      const admin = (await adminGet(`/${first}`)).body.data;
      expect(admin.events).toHaveLength(1);
      expect(admin.events[0].message).toBe(
        'ORDER_CONFIRMED → INTERNATIONAL_SHIPPING',
      );
    });

    it('배송 완료로 바꾸면 수령 시각이 남고 고객의 완료 탭에 나온다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const orderId = await placeOrder(token);
      const deliveredAt = new Date(Date.now() - 3 * HOUR * 1000).toISOString();

      // When
      await changeStage([orderId], {
        deliveryStage: 'DELIVERED',
        deliveredAt,
      }).expect(204);

      // Then
      const detail = (await userGetOrder(token, orderId)).body.data;
      expect(detail.deliveryStep).toBe(6);
      expect(detail.deliveredAt).toBe(deliveredAt);
      const completed = await request(app.getHttpServer())
        .get(`${ORDER_BASE}?status=COMPLETED`)
        .set('Authorization', `Bearer ${token}`)
        .set('Accept-language', 'ko');
      expect(completed.body.data.list.map((x: any) => x.orderId)).toEqual([
        orderId,
      ]);

      // When - 같은 단계를 다시 눌러도 수령 시각을 덮지 않는다
      await changeStage([orderId], { deliveryStage: 'DELIVERED' }).expect(204);

      // Then
      expect((await userGetOrder(token, orderId)).body.data.deliveredAt).toBe(
        deliveredAt,
      );

      // When - 단계를 되돌리면 수령 시각이 비워진다
      await changeStage([orderId], {
        deliveryStage: 'LOCAL_DELIVERY',
      }).expect(204);

      // Then
      expect(
        (await userGetOrder(token, orderId)).body.data.deliveredAt,
      ).toBeNull();
      const admin = (await adminGet(`/${orderId}`)).body.data;
      expect(admin.events[0].message).toBe(
        `DELIVERED → LOCAL_DELIVERY (deliveredAt ${deliveredAt} → -)`,
      );
    });

    it('단계를 먼저 옮긴 주문을 발주해도 단계가 되돌아가지 않는다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const orderId = await placeOrder(token, { paidHoursAgo: 48 });
      await changeStage([orderId], {
        deliveryStage: 'INTERNATIONAL_SHIPPING',
      }).expect(204);

      // When
      await adminPurchase(orderId).expect(204);

      // Then
      expect((await userGetOrder(token, orderId)).body.data.deliveryStage).toBe(
        'INTERNATIONAL_SHIPPING',
      );
    });

    it('조기 발주 사유가 500자여도 발주와 이력이 함께 저장된다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const orderId = await placeOrder(token, { paidHoursAgo: 1 });

      // When
      const res = await adminPurchase(orderId, {
        earlyReason: '가'.repeat(500),
      });

      // Then
      expect(res.status).toBe(204);
      const admin = (await adminGet(`/${orderId}`)).body.data;
      expect(admin.purchase.purchaseStatus).toBe('ORDERED');
      expect(admin.events[0].type).toBe('PURCHASED');
      expect(admin.events[0].message).toHaveLength(500);
    });

    it('하나라도 결제 완료가 아니면 전부 바뀌지 않는다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const paid = await placeOrder(token);
      const pending = await placeOrder(token, { paidHoursAgo: null });

      // When
      const res = await changeStage([paid, pending, 999999], {
        deliveryStage: 'DELIVERED',
      });

      // Then
      expect(res.status).toBe(409);
      expect((await userGetOrder(token, paid)).body.data.deliveryStep).toBe(1);
    });

    it('수령 시각이 미래이거나 배송 완료가 아닌 단계와 오면 400 이다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const orderId = await placeOrder(token);
      const future = new Date(Date.now() + HOUR * 1000).toISOString();
      const past = new Date(Date.now() - HOUR * 1000).toISOString();

      // When / Then
      expect(
        (
          await changeStage([orderId], {
            deliveryStage: 'DELIVERED',
            deliveredAt: future,
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await changeStage([orderId], {
            deliveryStage: 'LOCAL_DELIVERY',
            deliveredAt: past,
          })
        ).status,
      ).toBe(400);
      expect(
        (await changeStage([], { deliveryStage: 'DELIVERED' })).status,
      ).toBe(400);
      expect(
        (await changeStage([orderId], { deliveryStage: 'X' })).status,
      ).toBe(400);
    });

    it('대만 운송장을 넣으면 고객 상세에 보이고 단계는 그대로다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const orderId = await placeOrder(token);
      const path = `${ADMIN_ORDER_BASE}/${orderId}/local-delivery`;

      // When
      const res = await adminSend('patch', path, {
        localCarrier: '7-ELEVEN',
        localTrackingNo: ' D123 ',
      });

      // Then
      expect(res.status).toBe(204);
      expect((await userGetOrder(token, orderId)).body.data).toMatchObject({
        localCarrier: '7-ELEVEN',
        localTrackingNo: 'D123',
        deliveryStep: 1,
      });

      // When - 한 필드만 지운다
      await adminSend('patch', path, { localTrackingNo: null }).expect(204);

      // Then
      expect((await userGetOrder(token, orderId)).body.data).toMatchObject({
        localCarrier: '7-ELEVEN',
        localTrackingNo: null,
      });
      expect((await adminSend('patch', path, {})).status).toBe(400);
      expect(
        (
          await adminSend(
            'patch',
            `${ADMIN_ORDER_BASE}/999999/local-delivery`,
            { localCarrier: 'x' },
          )
        ).status,
      ).toBe(404);
    });
  });

  describe('/admin/shipment — 통관·물류', () => {
    const SHIPMENT_BASE = '/admin/shipment';

    function getShipment(path: string) {
      return request(app.getHttpServer())
        .get(`${SHIPMENT_BASE}${path}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }

    it('주문 두 건을 한 묶음에 싣고, 통관 완료여도 배송 단계는 그대로다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const first = await placeOrder(token);
      const second = await placeOrder(token);

      // When
      const res = await adminSend('post', SHIPMENT_BASE, {
        orderIds: [first, second],
        intlCarrier: 'EMS',
        intlTrackingNo: 'EG123456789KR',
        importDeclarationNo: 'AA2612345678',
        customsStatus: 'CLEARED',
        clearedAt: '2026-11-25T03:00:00.000Z',
      });

      // Then
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        sameIntlTrackingNoShipmentIds: [],
        sameImportDeclarationNoShipmentIds: [],
      });
      const shipmentId = res.body.data.shipmentId;
      const detail = (await getShipment(`/${shipmentId}`)).body.data;
      expect(detail.orders.map((x: any) => x.orderId)).toEqual([first, second]);
      expect(detail.orders[0].recipientName).toBe('李佳蓉');

      for (const orderId of [first, second]) {
        const admin = (await adminGet(`/${orderId}`)).body.data;

        expect(admin.delivery.deliveryStage).toBe('ORDER_CONFIRMED');
        expect(admin.delivery.shipments).toHaveLength(1);
        expect(admin.delivery.shipments[0]).toMatchObject({
          shipmentId,
          intlTrackingNo: 'EG123456789KR',
          importDeclarationNo: 'AA2612345678',
          customsStatus: 'CLEARED',
          clearedAt: '2026-11-25T03:00:00.000Z',
        });
        expect(admin.events[0].type).toBe('SHIPMENT_UPDATED');
      }
      // 고객 응답에는 통관 정보가 없다
      const customer = (await userGetOrder(token, first)).body.data;
      expect(JSON.stringify(customer)).not.toContain('AA2612345678');
    });

    it('운송장 번호와 수입신고번호가 같으면 400, 다른 묶음과 겹치면 경고만 한다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const orderId = await placeOrder(token);
      const first = await adminSend('post', SHIPMENT_BASE, {
        orderIds: [orderId],
        intlTrackingNo: 'DUP-1',
        importDeclarationNo: 'DEC-1',
      }).expect(201);

      // When
      const same = await adminSend('post', SHIPMENT_BASE, {
        orderIds: [orderId],
        intlTrackingNo: 'SAME',
        importDeclarationNo: 'SAME',
      });
      const dup = await adminSend('post', SHIPMENT_BASE, {
        orderIds: [orderId],
        intlTrackingNo: 'DUP-1',
        importDeclarationNo: 'DEC-1',
      });

      // Then
      expect(same.status).toBe(400);
      expect(dup.status).toBe(201);
      expect(dup.body.data.sameIntlTrackingNoShipmentIds).toEqual([
        first.body.data.shipmentId,
      ]);
      expect(dup.body.data.sameImportDeclarationNoShipmentIds).toEqual([
        first.body.data.shipmentId,
      ]);
      // 한 주문이 여러 묶음에 실릴 수 있다
      const admin = (await adminGet(`/${orderId}`)).body.data;
      expect(admin.delivery.shipments).toHaveLength(2);
    });

    it('PATCH 는 보낸 필드만 고치고 null 은 지우며 orderIds 는 통째로 바꾼다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const first = await placeOrder(token);
      const second = await placeOrder(token);
      const created = await adminSend('post', SHIPMENT_BASE, {
        orderIds: [first],
        intlCarrier: 'EMS',
        intlTrackingNo: 'T-1',
        memo: '메모',
      }).expect(201);
      const path = `${SHIPMENT_BASE}/${created.body.data.shipmentId}`;

      // When
      const res = await adminSend('patch', path, {
        customsStatus: 'HELD',
        memo: null,
        orderIds: [second],
      });

      // Then
      expect(res.status).toBe(200);
      const detail = (await getShipment(`/${created.body.data.shipmentId}`))
        .body.data;
      expect(detail).toMatchObject({
        intlCarrier: 'EMS',
        intlTrackingNo: 'T-1',
        customsStatus: 'HELD',
        memo: null,
      });
      expect(detail.orders.map((x: any) => x.orderId)).toEqual([second]);
      const removed = (await adminGet(`/${first}`)).body.data;
      expect(removed.delivery.shipments).toHaveLength(0);
      expect(removed.events[0].message).toContain('removed this order');

      // When - 번호를 같게 고치면 400, 빈 orderIds 도 400
      expect(
        (await adminSend('patch', path, { importDeclarationNo: 'T-1' })).status,
      ).toBe(400);
      expect((await adminSend('patch', path, { orderIds: [] })).status).toBe(
        400,
      );
      expect(
        (await adminSend('patch', `${SHIPMENT_BASE}/999999`, { memo: 'x' }))
          .status,
      ).toBe(404);
    });

    it('목록은 운송장·신고번호·주문번호로 찾고 통관 상태로 거른다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const first = await placeOrder(token);
      const second = await placeOrder(token);
      await adminSend('post', SHIPMENT_BASE, {
        orderIds: [first],
        intlTrackingNo: 'AAA-111',
      }).expect(201);
      await adminSend('post', SHIPMENT_BASE, {
        orderIds: [second],
        importDeclarationNo: 'BBB-222',
        customsStatus: 'IN_PROGRESS',
      }).expect(201);
      const orderNumber = (await userGetOrder(token, second)).body.data
        .orderNumber;

      // When
      const all = await getShipment('');
      const byTracking = await getShipment('?search=aaa-1');
      const byOrder = await getShipment(`?search=${orderNumber}`);
      const byStatus = await getShipment('?customsStatus=IN_PROGRESS');
      const none = await getShipment('?search=%25');

      // Then
      expect(all.body.data.total).toBe(2);
      expect(byTracking.body.data.list[0].intlTrackingNo).toBe('AAA-111');
      expect(byTracking.body.data.total).toBe(1);
      expect(byOrder.body.data.list[0].importDeclarationNo).toBe('BBB-222');
      expect(byStatus.body.data.total).toBe(1);
      expect(none.body.data.total).toBe(0);
    });

    it('결제 완료가 아닌 주문은 실을 수 없고, 회원 토큰은 401 이다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const pending = await placeOrder(token, { paidHoursAgo: null });

      // When / Then
      expect(
        (await adminSend('post', SHIPMENT_BASE, { orderIds: [pending] }))
          .status,
      ).toBe(409);
      expect(
        (await adminSend('post', SHIPMENT_BASE, { orderIds: [999999] })).status,
      ).toBe(409);
      expect(
        (
          await request(app.getHttpServer())
            .post(SHIPMENT_BASE)
            .set('Authorization', `Bearer ${token}`)
            .send({ orderIds: [pending] })
        ).status,
      ).toBe(401);
    });
  });
});

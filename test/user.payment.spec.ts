import { CacheService } from '@app/cache/cache.service';
import { EcpayInvoiceResultDto } from '@app/external/ecpay/ecpay-invoice.dto';
import { ExternalEcpayInvoiceService } from '@app/external/ecpay/ecpay-invoice.service';
import { generateCheckMacValue } from '@app/external/ecpay/ecpay.check-mac';
import { EcpayTradeInfoDto } from '@app/external/ecpay/ecpay.dto';
import { ExternalEcpayService } from '@app/external/ecpay/ecpay.service';
import {
  LinePayRequestResultDto,
  LinePayResultDto,
} from '@app/external/linepay/linepay.dto';
import { ExternalLinePayService } from '@app/external/linepay/linepay.service';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { EcpayPaymentService } from '../apps/api/src/module/payment/ecpay-payment.service';
import { PaymentBatchService } from '../apps/api/src/module/payment/payment-batch.service';

const USER_AUTH_BASE = '/user/auth';
const CART_BASE = '/user/cart';
const ORDER_BASE = '/user/order';

// env/test.ts 의 ECPay 공개 테스트 상점 값
const ECPAY = {
  merchantId: '3002607',
  hashKey: 'pwFHCqoQZGmho4w6',
  hashIV: 'EkRm7iFT261dpevs',
};
const STOREFRONT = 'http://storefront.test';
const TRANSACTION_ID = '2026102612345678901';

describe('결제 (E2E) — ECPay · LINE Pay', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득 (최초 1회만 부트스트랩)
    app = await getTestApp();
    dataSource = getDataSource(app);
  }, 60_000);

  beforeEach(async () => {
    // 결제 확정 커밋 뒤 전자발표를 발행한다 — 테스트에서는 ECPay 를 부르지 않는다
    jest.spyOn(app.get(ExternalEcpayInvoiceService), 'issue').mockResolvedValue(
      EcpayInvoiceResultDto.fromIssue({
        RtnCode: 1,
        RtnMsg: 'ok',
        InvoiceNo: 'LY74004967',
        InvoiceDate: '2026-10-26 15:30:00',
        RandomNumber: '3204',
      }),
    );

    await dataSource.query(
      `INSERT INTO shipping_policy
         (id, base_fee, remote_island_fee, remote_island_promotion, free_shipping_threshold)
       VALUES (1, 60, 100, false, 100000)`,
    );
  });

  afterEach(async () => {
    jest.restoreAllMocks();

    const cache = app.get(CacheService);
    for (const key of await cache.scan('linepay_confirm_lock')) {
      await cache.del(key);
    }

    await truncateTables(dataSource, [
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
  async function signUpAndLogin(): Promise<{ userId: number; token: string }> {
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

    const rows = await dataSource.query(
      `SELECT id FROM "user" WHERE email = $1`,
      [body.email],
    );
    const userId = rows[0].id as number;

    await dataSource.query(
      `INSERT INTO user_profile (user_id, name, postal_code, city, district, detail_address)
       VALUES ($1, '李佳蓉', '110', '臺北市', '信義區', '松高路 11號 5樓')`,
      [userId],
    );
    await dataSource.query(`UPDATE "user" SET phone = $1 WHERE id = $2`, [
      `+886${faker.string.numeric(9)}`,
      userId,
    ]);

    return { userId, token: loginRes.body.data.token as string };
  }

  async function createVariant(stockQuantity = 10, price = 1000) {
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
      [productRows[0].id, price],
    );
    const variantRows = await dataSource.query(
      `INSERT INTO product_variant (product_item_id, sku, stock_quantity, status)
       VALUES ($1, $2, $3, 'ACTIVE') RETURNING id`,
      [
        itemRows[0].id,
        faker.string.alphanumeric(12).toUpperCase(),
        stockQuantity,
      ],
    );

    return variantRows[0].id as number;
  }

  async function addToCart(
    token: string,
    productVariantId: number,
    quantity = 1,
  ) {
    const res = await request(app.getHttpServer())
      .post(CART_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productVariantId, quantity }] });
    expect(res.status).toBe(201);

    const found = (
      res.body.data.items as { cartItemId: number; productVariantId: number }[]
    ).find((item) => item.productVariantId === productVariantId);

    return found?.cartItemId ?? res.body.data.items[0].cartItemId;
  }

  async function createOrder(
    token: string,
    source: Record<string, unknown>,
    paymentMethod = 'ECPAY',
  ): Promise<{ orderId: number; totalAmount: number }> {
    const res = await request(app.getHttpServer())
      .post(ORDER_BASE)
      .set('Authorization', `Bearer ${token}`)
      .set('Accept-language', 'ko')
      .send({ ...source, paymentMethod, useDefaultShipping: true });
    expect(res.status).toBe(201);

    return {
      orderId: res.body.data.orderId,
      totalAmount: res.body.data.totalAmount,
    };
  }

  function startPayment(token: string, orderId: number) {
    return request(app.getHttpServer())
      .post(`${ORDER_BASE}/${orderId}/payment`)
      .set('Authorization', `Bearer ${token}`)
      .set('Accept-language', 'ko');
  }

  async function stockOf(variantId: number): Promise<number> {
    const rows = await dataSource.query(
      `SELECT stock_quantity FROM product_variant WHERE id = $1`,
      [variantId],
    );

    return rows[0].stock_quantity;
  }

  async function orderRow(orderId: number) {
    const rows = await dataSource.query(
      `SELECT status, stock_reserved, paid_at FROM "order" WHERE id = $1`,
      [orderId],
    );

    return rows[0];
  }

  async function paymentRow(paymentId: number) {
    const rows = await dataSource.query(`SELECT * FROM payment WHERE id = $1`, [
      paymentId,
    ]);

    return rows[0];
  }

  function tokenOf(handoffUrl: string): string {
    return handoffUrl.split('/').pop();
  }

  function signed(params: Record<string, string>) {
    return {
      ...params,
      CheckMacValue: generateCheckMacValue(params, ECPAY.hashKey, ECPAY.hashIV),
    };
  }

  function ecpayPost(path: string, params: Record<string, string>) {
    return request(app.getHttpServer())
      .post(`/payment/ecpay/${path}`)
      .type('form')
      .send(params);
  }

  function paidParams(
    tradeNo: string,
    amount: number,
    extra: Record<string, string> = {},
  ) {
    return signed({
      MerchantID: ECPAY.merchantId,
      MerchantTradeNo: tradeNo,
      StoreID: '',
      RtnCode: '1',
      RtnMsg: '交易成功',
      TradeNo: '2510261234567890',
      TradeAmt: String(amount),
      PaymentDate: '2026/10/26 12:34:56',
      PaymentType: 'Credit_CreditCard',
      PaymentTypeChargeFee: '25',
      TradeDate: '2026/10/26 12:30:00',
      SimulatePaid: '0',
      CustomField1: '',
      ...extra,
    });
  }

  /** 회원 · SKU · 주문 · 결제 시작까지 한 번에 */
  async function ecpayStarted(options?: { stock?: number; quantity?: number }) {
    const { userId, token } = await signUpAndLogin();
    const variantId = await createVariant(options?.stock ?? 10);
    const cartItemId = await addToCart(
      token,
      variantId,
      options?.quantity ?? 2,
    );
    const { orderId, totalAmount } = await createOrder(token, {
      cartItemIds: [cartItemId],
    });

    const res = await startPayment(token, orderId);
    expect(res.status).toBe(201);

    const payment = await paymentRow(res.body.data.paymentId);

    return {
      userId,
      token,
      variantId,
      cartItemId,
      orderId,
      totalAmount,
      paymentId: res.body.data.paymentId as number,
      tradeNo: payment.merchant_trade_no as string,
      handoffUrl: res.body.data.handoffUrl as string,
      resultToken: res.body.data.resultToken as string,
    };
  }

  function mockLinePayRequest() {
    return jest
      .spyOn(app.get(ExternalLinePayService), 'request')
      .mockResolvedValue(
        LinePayRequestResultDto.from({
          returnCode: '0000',
          returnMessage: 'Success.',
          info: {
            transactionId: TRANSACTION_ID,
            paymentUrl: {
              web: 'https://sandbox-web-pay.line.me/web/payment/wait?transactionReserveId=abc',
              app: 'line://pay/payment/abc',
            },
          },
        }),
      );
  }

  function linePayResult(returnCode: string, returnMessage = 'msg') {
    return LinePayResultDto.from({ returnCode, returnMessage });
  }

  async function linePayStarted() {
    const { userId, token } = await signUpAndLogin();
    const variantId = await createVariant(10);
    const cartItemId = await addToCart(token, variantId, 1);
    const { orderId, totalAmount } = await createOrder(
      token,
      { cartItemIds: [cartItemId] },
      'LINE_PAY',
    );
    const requestSpy = mockLinePayRequest();

    const res = await startPayment(token, orderId);
    expect(res.status).toBe(201);

    const payment = await paymentRow(res.body.data.paymentId);

    return {
      userId,
      token,
      variantId,
      orderId,
      totalAmount,
      requestSpy,
      paymentId: res.body.data.paymentId as number,
      tradeNo: payment.merchant_trade_no as string,
      body: res.body.data,
    };
  }

  // -------------------------------------------------------------------------
  describe('POST /user/order/:id/payment — 결제 시작 · 재고 선점', () => {
    it('ECPay 는 handoffUrl 을 주고, 재고를 잡고, 시도를 REQUESTED 로 만든다', async () => {
      // Given / When
      const started = await ecpayStarted({ stock: 10, quantity: 2 });

      // Then
      expect(started.handoffUrl).toMatch(
        /^http:\/\/localhost\/payment\/ecpay\/handoff\/[\w-]+$/,
      );
      expect(started.tradeNo).toMatch(/^ST[0-9A-Z]{1,18}$/);
      expect(await stockOf(started.variantId)).toBe(8);
      expect((await orderRow(started.orderId)).stock_reserved).toBe(true);

      const payment = await paymentRow(started.paymentId);
      expect(payment.status).toBe('REQUESTED');
      expect(payment.amount).toBe(started.totalAmount);
      expect(payment.locale).toBe('ko');
    });

    it('재고가 모자라면 409 이고 아무것도 줄지 않는다', async () => {
      // Given — 담을 때는 있었는데 결제 직전에 줄었다
      const { token } = await signUpAndLogin();
      const variantId = await createVariant(5);
      const cartItemId = await addToCart(token, variantId, 3);
      const { orderId } = await createOrder(token, {
        cartItemIds: [cartItemId],
      });
      await dataSource.query(
        `UPDATE product_variant SET stock_quantity = 2 WHERE id = $1`,
        [variantId],
      );

      // When
      const res = await startPayment(token, orderId);

      // Then
      expect(res.status).toBe(409);
      expect(res.body.data.productVariantIds).toEqual([variantId]);
      expect(await stockOf(variantId)).toBe(2);
      expect((await orderRow(orderId)).stock_reserved).toBe(false);
      expect(
        await dataSource.query(`SELECT id FROM payment WHERE order_id = $1`, [
          orderId,
        ]),
      ).toHaveLength(0);
    });

    it('남의 주문이면 404', async () => {
      // Given
      const started = await ecpayStarted();
      const other = await signUpAndLogin();

      // When
      const res = await startPayment(other.token, started.orderId);

      // Then
      expect(res.status).toBe(404);
    });

    it('다시 결제하면 이전 시도는 취소되고 재고는 한 번만 잡힌다', async () => {
      // Given
      const started = await ecpayStarted({ stock: 10, quantity: 2 });

      // When
      const res = await startPayment(started.token, started.orderId);

      // Then
      expect(res.status).toBe(201);
      expect(res.body.data.paymentId).not.toBe(started.paymentId);
      expect((await paymentRow(started.paymentId)).status).toBe('CANCELED');
      expect(await stockOf(started.variantId)).toBe(8);
    });

    it('마지막 1개를 두 명이 동시에 결제하면 한 명만 성공한다', async () => {
      // Given
      const variantId = await createVariant(1);
      const buyers = await Promise.all([signUpAndLogin(), signUpAndLogin()]);
      const orders = [];
      for (const buyer of buyers) {
        const cartItemId = await addToCart(buyer.token, variantId, 1);
        orders.push(
          await createOrder(buyer.token, { cartItemIds: [cartItemId] }),
        );
      }

      // When
      const results = await Promise.all(
        buyers.map((buyer, i) => startPayment(buyer.token, orders[i].orderId)),
      );

      // Then
      expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
      expect(await stockOf(variantId)).toBe(0);
    });

    it('이미 결제된 주문은 409', async () => {
      // Given
      const started = await ecpayStarted();
      await ecpayPost(
        'return',
        paidParams(started.tradeNo, started.totalAmount),
      );

      // When
      const res = await startPayment(started.token, started.orderId);

      // Then
      expect(res.status).toBe(409);
    });
  });

  describe('GET /payment/ecpay/handoff/:token — 결제창 진입', () => {
    it('처음 열면 ECPay 로 auto-submit 하는 HTML 을 주고, 두 번째는 주지 않는다', async () => {
      // Given
      const started = await ecpayStarted();
      const path = `/payment/ecpay/handoff/${tokenOf(started.handoffUrl)}`;

      // When
      const first = await request(app.getHttpServer()).get(path);
      const second = await request(app.getHttpServer()).get(path);

      // Then
      expect(first.status).toBe(200);
      expect(first.headers['content-type']).toContain('text/html');
      expect(first.text).toContain(
        'action="https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5"',
      );
      expect(first.text).toContain(`value="${started.tradeNo}"`);
      expect(first.text).toContain('name="CheckMacValue"');
      expect(first.text).toContain('name="IgnorePayment" value="BARCODE"');
      expect(first.text).toContain('name="Language" value="KOR"');

      expect(second.status).toBe(409);
      expect(second.text).not.toContain('CheckMacValue');
    });

    it('form 의 CheckMacValue 가 필드들로 다시 계산한 값과 같다', async () => {
      // Given
      const started = await ecpayStarted();
      const res = await request(app.getHttpServer()).get(
        `/payment/ecpay/handoff/${tokenOf(started.handoffUrl)}`,
      );

      // When — HTML 에서 hidden 필드를 다시 모은다
      const fields: Record<string, string> = {};
      for (const match of res.text.matchAll(
        /<input type="hidden" name="([^"]+)" value="([^"]*)">/g,
      )) {
        fields[match[1]] = match[2]
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&');
      }

      // Then
      expect(fields.TotalAmount).toBe(String(started.totalAmount));
      expect(fields.CheckMacValue).toBe(
        generateCheckMacValue(fields, ECPAY.hashKey, ECPAY.hashIV),
      );
    });

    it('없는 토큰은 404', async () => {
      const res = await request(app.getHttpServer()).get(
        '/payment/ecpay/handoff/nope',
      );

      expect(res.status).toBe(404);
    });
  });

  describe('POST /payment/ecpay/return — 결제 결과', () => {
    it('결제 성공이면 1|OK, 주문 PAID, 이 주문에 쓴 장바구니 라인만 지운다', async () => {
      // Given — 장바구니에 두 줄, 주문은 한 줄로
      const { token } = await signUpAndLogin();
      const orderedVariant = await createVariant(10);
      const keptVariant = await createVariant(10);
      const orderedLine = await addToCart(token, orderedVariant, 2);
      const keptLine = await addToCart(token, keptVariant, 1);
      const { orderId, totalAmount } = await createOrder(token, {
        cartItemIds: [orderedLine],
      });
      const start = await startPayment(token, orderId);
      const { merchant_trade_no: tradeNo } = await paymentRow(
        start.body.data.paymentId,
      );

      // When
      const res = await ecpayPost('return', paidParams(tradeNo, totalAmount));

      // Then
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toBe('1|OK');

      const order = await orderRow(orderId);
      expect(order.status).toBe('PAID');
      expect(order.paid_at).not.toBeNull();

      const payment = await paymentRow(start.body.data.paymentId);
      expect(payment.status).toBe('PAID');
      expect(payment.pg_transaction_id).toBe('2510261234567890');
      expect(payment.pg_payment_type).toBe('Credit_CreditCard');

      const cartIds = (
        await dataSource.query(`SELECT id FROM cart_item ORDER BY id`)
      ).map((row: { id: number }) => row.id);
      expect(cartIds).toEqual([keptLine]);
      expect(await stockOf(orderedVariant)).toBe(8);
    });

    it('결제가 확정되면 커밋 뒤에 전자발표를 발행한다', async () => {
      // Given
      const started = await ecpayStarted();

      // When
      await ecpayPost(
        'return',
        paidParams(started.tradeNo, started.totalAmount),
      );

      // Then — 커밋 뒤 비동기로 돈다
      let row: { status: string; invoice_no: string } | undefined;
      for (let i = 0; i < 20 && row?.status !== 'ISSUED'; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        [row] = await dataSource.query(
          `SELECT status, invoice_no FROM order_invoice WHERE order_id = $1`,
          [started.orderId],
        );
      }
      expect(row).toEqual({ status: 'ISSUED', invoice_no: 'LY74004967' });
    });

    it('"구매하기" 주문은 결제돼도 장바구니를 건드리지 않는다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const variantId = await createVariant(10);
      const cartLine = await addToCart(token, variantId, 1);
      const { orderId, totalAmount } = await createOrder(token, {
        items: [{ productVariantId: variantId, quantity: 1 }],
      });
      const start = await startPayment(token, orderId);
      const { merchant_trade_no: tradeNo } = await paymentRow(
        start.body.data.paymentId,
      );

      // When
      await ecpayPost('return', paidParams(tradeNo, totalAmount));

      // Then
      expect((await orderRow(orderId)).status).toBe('PAID');
      const cartIds = (await dataSource.query(`SELECT id FROM cart_item`)).map(
        (row: { id: number }) => row.id,
      );
      expect(cartIds).toEqual([cartLine]);
    });

    it('CheckMacValue 가 틀리면 1|OK 가 아니고 상태도 그대로다', async () => {
      // Given
      const started = await ecpayStarted();
      const params = {
        ...paidParams(started.tradeNo, started.totalAmount),
        CheckMacValue: 'FORGED',
      };

      // When
      const res = await ecpayPost('return', params);

      // Then
      expect(res.text).not.toBe('1|OK');
      expect((await orderRow(started.orderId)).status).toBe('PENDING');
      expect((await paymentRow(started.paymentId)).status).toBe('REQUESTED');
    });

    it('금액이 다르면 결제로 처리하지 않는다', async () => {
      // Given
      const started = await ecpayStarted();

      // When
      const res = await ecpayPost(
        'return',
        paidParams(started.tradeNo, started.totalAmount - 1),
      );

      // Then
      expect(res.text).not.toBe('1|OK');
      expect((await orderRow(started.orderId)).status).toBe('PENDING');
    });

    it('같은 통지가 두 번 와도 한 번만 반영된다', async () => {
      // Given
      const started = await ecpayStarted({ stock: 10, quantity: 2 });
      const params = paidParams(started.tradeNo, started.totalAmount);

      // When
      const first = await ecpayPost('return', params);
      const second = await ecpayPost('return', params);

      // Then
      expect([first.text, second.text]).toEqual(['1|OK', '1|OK']);
      expect(await stockOf(started.variantId)).toBe(8);
      expect((await orderRow(started.orderId)).status).toBe('PAID');
    });

    it('DTO 에 없는 필드가 섞여 와도 400 이 아니다', async () => {
      // Given
      const started = await ecpayStarted();

      // When
      const res = await ecpayPost(
        'return',
        paidParams(started.tradeNo, started.totalAmount, {
          SomeNewField: 'x',
          CustomField4: 'y',
        }),
      );

      // Then
      expect(res.status).toBe(200);
      expect(res.text).toBe('1|OK');
    });

    it('모의 결제(SimulatePaid=1)는 운영 설정에서 결제로 처리하지 않는다', async () => {
      // Given
      const started = await ecpayStarted();
      jest
        .spyOn(app.get(EcpayPaymentService), 'isSimulatedPaymentAllowed')
        .mockReturnValue(false);

      // When
      const res = await ecpayPost(
        'return',
        paidParams(started.tradeNo, started.totalAmount, { SimulatePaid: '1' }),
      );

      // Then
      expect(res.text).toBe('1|OK');
      expect((await orderRow(started.orderId)).status).toBe('PENDING');
    });

    it('밀려난 이전 시도에 늦게 돈이 들어와도 주문은 결제된다', async () => {
      // Given — 첫 시도의 결제창을 연 채 두 번째 시도를 시작했다
      const started = await ecpayStarted({ stock: 10, quantity: 2 });
      await startPayment(started.token, started.orderId);

      // When
      const res = await ecpayPost(
        'return',
        paidParams(started.tradeNo, started.totalAmount),
      );

      // Then
      expect(res.text).toBe('1|OK');
      expect((await orderRow(started.orderId)).status).toBe('PAID');
      expect(await stockOf(started.variantId)).toBe(8);
    });
  });

  describe('ATM · 편의점 (입금 대기)', () => {
    function atmIssuedParams(tradeNo: string, amount: number) {
      return signed({
        MerchantID: ECPAY.merchantId,
        MerchantTradeNo: tradeNo,
        StoreID: '',
        RtnCode: '2',
        RtnMsg: 'Get VirtualAccount Succeeded',
        TradeNo: '2510261234567891',
        TradeAmt: String(amount),
        PaymentType: 'ATM_LAND',
        TradeDate: '2026/10/26 12:30:00',
        BankCode: '005',
        vAccount: '5219111913127434',
        ExpireDate: '2026/10/28',
        CustomField1: '',
      });
    }

    it('번호 발급이면 입금 대기, 주문 상세에 계좌가 나오고, 입금되면 PAID', async () => {
      // Given
      const started = await ecpayStarted({ stock: 10, quantity: 2 });

      // When — 번호 발급
      const info = await ecpayPost(
        'payment-info',
        atmIssuedParams(started.tradeNo, started.totalAmount),
      );

      // Then
      expect(info.text).toBe('1|OK');
      expect((await orderRow(started.orderId)).status).toBe('PAYMENT_WAITING');

      const detail = await request(app.getHttpServer())
        .get(`${ORDER_BASE}/${started.orderId}`)
        .set('Authorization', `Bearer ${started.token}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.status).toBe('PAYMENT_WAITING');
      expect(detail.body.data.payment).toMatchObject({
        status: 'WAITING_DEPOSIT',
        pgPaymentType: 'ATM_LAND',
        depositInfo: { bankCode: '005', account: '5219111913127434' },
      });
      expect(new Date(detail.body.data.payment.expireAt).toISOString()).toBe(
        '2026-10-28T15:59:59.000Z',
      );
      expect(await stockOf(started.variantId)).toBe(8);

      // When — 입금
      const paid = await ecpayPost(
        'return',
        paidParams(started.tradeNo, started.totalAmount, {
          PaymentType: 'ATM_LAND',
        }),
      );

      // Then
      expect(paid.text).toBe('1|OK');
      expect((await orderRow(started.orderId)).status).toBe('PAID');
      expect(await stockOf(started.variantId)).toBe(8);
    });

    it('입금 기한이 지나면 ECPay 에 물어 미입금일 때 만료시키고 재고를 돌려주고 주문을 취소한다', async () => {
      // Given
      const started = await ecpayStarted({ stock: 10, quantity: 2 });
      await ecpayPost(
        'payment-info',
        atmIssuedParams(started.tradeNo, started.totalAmount),
      );
      await dataSource.query(
        `UPDATE payment SET expire_at = NOW() - interval '61 minutes' WHERE id = $1`,
        [started.paymentId],
      );
      jest
        .spyOn(app.get(ExternalEcpayService), 'queryTradeInfo')
        .mockResolvedValue(
          EcpayTradeInfoDto.from(
            { TradeStatus: '0', TradeAmt: String(started.totalAmount) },
            true,
          ),
        );

      // When
      await app.get(PaymentBatchService).expireDeposits();

      // Then
      expect((await paymentRow(started.paymentId)).status).toBe('EXPIRED');
      expect(await stockOf(started.variantId)).toBe(10);
      const order = await orderRow(started.orderId);
      expect(order.status).toBe('CANCELED');
      expect(order.stock_reserved).toBe(false);
    });
  });

  describe('결제를 마친 브라우저 · 결과 조회', () => {
    it('검증된 브라우저 복귀는 프론트 결과 페이지로 303', async () => {
      // Given
      const started = await ecpayStarted();

      // When
      const res = await ecpayPost(
        'browser-return',
        paidParams(started.tradeNo, started.totalAmount),
      );

      // Then
      expect(res.status).toBe(303);
      expect(res.headers.location).toBe(
        `${STOREFRONT}/payment/result?h=${encodeURIComponent(started.resultToken)}`,
      );
    });

    it('검증 안 된 브라우저 복귀에는 결과 토큰을 붙이지 않는다', async () => {
      // Given
      const started = await ecpayStarted();

      // When
      const res = await ecpayPost('browser-return', {
        ...paidParams(started.tradeNo, started.totalAmount),
        CheckMacValue: 'FORGED',
      });

      // Then
      expect(res.status).toBe(200);
      expect(res.text).not.toContain(started.resultToken);
    });

    it('토큰으로 결과를 보되 이름·주소·전화번호는 주지 않는다', async () => {
      // Given
      const started = await ecpayStarted();
      await ecpayPost(
        'return',
        paidParams(started.tradeNo, started.totalAmount),
      );

      // When
      const res = await request(app.getHttpServer()).get(
        `/payment/result/${started.resultToken}`,
      );

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        orderId: started.orderId,
        orderStatus: 'PAID',
        payment: { status: 'PAID', method: 'ECPAY' },
      });
      expect(JSON.stringify(res.body)).not.toContain('李佳蓉');
      expect(JSON.stringify(res.body)).not.toContain('松高路');
    });

    it('없는 토큰은 404', async () => {
      const res = await request(app.getHttpServer()).get(
        '/payment/result/nope',
      );

      expect(res.status).toBe(404);
    });
  });

  describe('LINE Pay', () => {
    it('결제 시작은 LINE Pay 결제 URL 을 주고 19자리 transactionId 를 그대로 저장한다', async () => {
      // Given / When
      const started = await linePayStarted();

      // Then
      expect(started.body.paymentUrl).toContain('sandbox-web-pay.line.me');
      expect(started.body.appUrl).toBe('line://pay/payment/abc');
      expect(started.body.handoffUrl).toBeNull();

      const payment = await paymentRow(started.paymentId);
      expect(payment.status).toBe('REQUESTED');
      expect(payment.pg_transaction_id).toBe(TRANSACTION_ID);

      const [input] = started.requestSpy.mock.calls[0];
      expect(input.orderId).toBe(started.tradeNo);
      expect(input.amount).toBe(started.totalAmount);
      expect(
        input.products.reduce((sum, p) => sum + p.price * p.quantity, 0),
      ).toBe(started.totalAmount);
      expect(input.confirmUrl).toBe('http://localhost/payment/linepay/confirm');
    });

    it('LINE Pay 요청이 거절되면 500, 시도는 FAILED, 재고는 돌아온다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const variantId = await createVariant(10);
      const cartItemId = await addToCart(token, variantId, 1);
      const { orderId } = await createOrder(
        token,
        { cartItemIds: [cartItemId] },
        'LINE_PAY',
      );
      jest.spyOn(app.get(ExternalLinePayService), 'request').mockResolvedValue(
        LinePayRequestResultDto.from({
          returnCode: '1104',
          returnMessage: 'Merchant not found',
        }),
      );

      // When
      const res = await startPayment(token, orderId);

      // Then
      expect(res.status).toBe(500);
      expect(await stockOf(variantId)).toBe(10);
      const rows = await dataSource.query(
        `SELECT status, failure_code FROM payment WHERE order_id = $1`,
        [orderId],
      );
      expect(rows).toEqual([{ status: 'FAILED', failure_code: '1104' }]);
      expect((await orderRow(orderId)).status).toBe('PENDING');
    });

    it('승인 후 confirmUrl 로 오면 Confirm 하고 PAID, 결과 페이지로 303', async () => {
      // Given
      const started = await linePayStarted();
      const confirmSpy = jest
        .spyOn(app.get(ExternalLinePayService), 'confirm')
        .mockResolvedValue(linePayResult('0000', 'Success.'));

      // When
      const res = await request(app.getHttpServer()).get(
        `/payment/linepay/confirm?transactionId=${TRANSACTION_ID}&orderId=${started.tradeNo}`,
      );

      // Then
      expect(res.status).toBe(303);
      expect(res.headers.location).toContain(`${STOREFRONT}/payment/result?h=`);
      expect(confirmSpy).toHaveBeenCalledWith(
        TRANSACTION_ID,
        started.totalAmount,
      );
      expect((await orderRow(started.orderId)).status).toBe('PAID');
      expect(await stockOf(started.variantId)).toBe(9);
    });

    it('confirmUrl 이 두 번 와도 Confirm 은 한 번만 부른다', async () => {
      // Given
      const started = await linePayStarted();
      const confirmSpy = jest
        .spyOn(app.get(ExternalLinePayService), 'confirm')
        .mockResolvedValue(linePayResult('0000', 'Success.'));
      const url = `/payment/linepay/confirm?transactionId=${TRANSACTION_ID}&orderId=${started.tradeNo}`;

      // When
      await request(app.getHttpServer()).get(url);
      await request(app.getHttpServer()).get(url);

      // Then
      expect(confirmSpy).toHaveBeenCalledTimes(1);
    });

    it('Confirm 이 실패하면 FAILED, 재고는 돌아오고 주문은 다시 결제할 수 있다', async () => {
      // Given
      const started = await linePayStarted();
      jest
        .spyOn(app.get(ExternalLinePayService), 'confirm')
        .mockResolvedValue(linePayResult('1145', 'Payment in progress'));
      // Confirm 이 0000 이 아니면 상태 조회로 확인한다 — 실패(0122)로 확정
      jest
        .spyOn(app.get(ExternalLinePayService), 'checkStatus')
        .mockResolvedValue(linePayResult('0122', 'Failed'));

      // When
      await request(app.getHttpServer()).get(
        `/payment/linepay/confirm?transactionId=${TRANSACTION_ID}&orderId=${started.tradeNo}`,
      );

      // Then
      expect((await paymentRow(started.paymentId)).status).toBe('FAILED');
      expect(await stockOf(started.variantId)).toBe(10);
      expect((await orderRow(started.orderId)).status).toBe('PENDING');
    });

    it('transactionId 가 다르면 아무것도 하지 않는다', async () => {
      // Given
      const started = await linePayStarted();
      const confirmSpy = jest.spyOn(app.get(ExternalLinePayService), 'confirm');

      // When
      await request(app.getHttpServer()).get(
        `/payment/linepay/confirm?transactionId=1111111111111111111&orderId=${started.tradeNo}`,
      );

      // Then
      expect(confirmSpy).not.toHaveBeenCalled();
      expect((await paymentRow(started.paymentId)).status).toBe('REQUESTED');
    });

    it('LINE Pay 화면에서 취소하면 CANCELED, 재고는 돌아온다', async () => {
      // Given
      const started = await linePayStarted();

      // When
      const res = await request(app.getHttpServer()).get(
        `/payment/linepay/cancel?transactionId=${TRANSACTION_ID}&orderId=${started.tradeNo}`,
      );

      // Then
      expect(res.status).toBe(303);
      expect((await paymentRow(started.paymentId)).status).toBe('CANCELED');
      expect(await stockOf(started.variantId)).toBe(10);
    });

    it('confirmUrl 로 돌아오지 않은 승인 건은 배치가 Confirm 해서 PAID 로 만든다', async () => {
      // Given
      const started = await linePayStarted();
      await dataSource.query(
        `UPDATE payment SET requested_at = NOW() - interval '15 minutes' WHERE id = $1`,
        [started.paymentId],
      );
      jest
        .spyOn(app.get(ExternalLinePayService), 'checkStatus')
        .mockResolvedValue(linePayResult('0110', 'Authorized'));
      const confirmSpy = jest
        .spyOn(app.get(ExternalLinePayService), 'confirm')
        .mockResolvedValue(linePayResult('0000', 'Success.'));

      // When
      await app.get(PaymentBatchService).reconcileLinePay();

      // Then
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect((await orderRow(started.orderId)).status).toBe('PAID');
    });

    it('30분 넘게 승인하지 않으면 배치가 만료시키고 재고를 돌려준다', async () => {
      // Given
      const started = await linePayStarted();
      await dataSource.query(
        `UPDATE payment SET requested_at = NOW() - interval '31 minutes' WHERE id = $1`,
        [started.paymentId],
      );
      jest
        .spyOn(app.get(ExternalLinePayService), 'checkStatus')
        .mockResolvedValue(linePayResult('0000', 'Not authorized'));

      // When
      await app.get(PaymentBatchService).reconcileLinePay();

      // Then
      expect((await paymentRow(started.paymentId)).status).toBe('EXPIRED');
      expect(await stockOf(started.variantId)).toBe(10);
    });
  });

  describe('검증에서 막은 경로', () => {
    it('ReturnURL 이 결제 성공이 아니면 상태를 바꾸지 않는다 (보류 코드일 수 있다)', async () => {
      // Given
      const started = await ecpayStarted({ stock: 10, quantity: 2 });

      // When
      const res = await ecpayPost(
        'return',
        paidParams(started.tradeNo, started.totalAmount, {
          RtnCode: '10300066',
          RtnMsg: '交易付款結果待確認中',
        }),
      );

      // Then
      expect(res.text).toBe('1|OK');
      expect((await paymentRow(started.paymentId)).status).toBe('REQUESTED');
      expect(await stockOf(started.variantId)).toBe(8);
    });

    it('form 이 아닌 본문(text/plain)은 서명 계산 전에 거절한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post('/payment/ecpay/return')
        .set('Content-Type', 'text/plain')
        .send('x'.repeat(5000));

      // Then
      expect(res.status).toBe(200);
      expect(res.text).toBe('0|Bad Request');
    });

    it('서명이 틀린 콜백은 원문 대신 요약만 남긴다', async () => {
      // Given
      const started = await ecpayStarted();

      // When
      await ecpayPost('return', {
        ...paidParams(started.tradeNo, started.totalAmount),
        Junk: 'y'.repeat(1500),
        CheckMacValue: 'FORGED',
      });

      // Then
      const [event] = await dataSource.query(
        `SELECT payload FROM payment_event WHERE note = 'CheckMacValue mismatch'`,
      );
      expect(Object.keys(event.payload).sort()).toEqual([
        'MerchantTradeNo',
        'RtnCode',
        'keys',
      ]);
      expect(JSON.stringify(event.payload)).not.toContain('yyyy');
    });

    it('입금 기한이 지났어도 ECPay 가 입금됐다고 하면 PAID 로 메운다 (ReturnURL 을 놓친 경우)', async () => {
      // Given
      const started = await ecpayStarted({ stock: 10, quantity: 2 });
      await ecpayPost(
        'payment-info',
        signed({
          MerchantID: ECPAY.merchantId,
          MerchantTradeNo: started.tradeNo,
          RtnCode: '2',
          RtnMsg: 'ok',
          TradeNo: '2510261234567891',
          TradeAmt: String(started.totalAmount),
          PaymentType: 'ATM_LAND',
          BankCode: '005',
          vAccount: '5219111913127434',
          ExpireDate: '2026/10/28',
        }),
      );
      await dataSource.query(
        `UPDATE payment SET expire_at = NOW() - interval '61 minutes' WHERE id = $1`,
        [started.paymentId],
      );
      jest
        .spyOn(app.get(ExternalEcpayService), 'queryTradeInfo')
        .mockResolvedValue(
          EcpayTradeInfoDto.from(
            {
              TradeStatus: '1',
              TradeAmt: String(started.totalAmount),
              TradeNo: '2510261234567891',
              PaymentType: 'ATM_LAND',
              PaymentDate: '2026/10/27 10:00:00',
            },
            true,
          ),
        );

      // When
      await app.get(PaymentBatchService).expireDeposits();

      // Then
      expect((await orderRow(started.orderId)).status).toBe('PAID');
      expect(await stockOf(started.variantId)).toBe(8);
    });

    it('ECPay 응답 서명이 안 맞으면 입금 기한이 지나도 바로 만료하지 않는다', async () => {
      // Given
      const started = await ecpayStarted();
      await dataSource.query(
        `UPDATE payment SET status = 'WAITING_DEPOSIT', expire_at = NOW() - interval '61 minutes' WHERE id = $1`,
        [started.paymentId],
      );
      jest
        .spyOn(app.get(ExternalEcpayService), 'queryTradeInfo')
        .mockResolvedValue(EcpayTradeInfoDto.from({ TradeStatus: '0' }, false));

      // When
      await app.get(PaymentBatchService).expireDeposits();

      // Then
      expect((await paymentRow(started.paymentId)).status).toBe(
        'WAITING_DEPOSIT',
      );
    });

    it('주문이 이미 결제됐으면 새 시도의 결제창을 열지 않는다', async () => {
      // Given — 두 번째 시도를 만든 뒤 첫 시도가 결제됐다
      const started = await ecpayStarted();
      const second = await startPayment(started.token, started.orderId);
      await ecpayPost(
        'return',
        paidParams(started.tradeNo, started.totalAmount),
      );

      // When
      const res = await request(app.getHttpServer()).get(
        `/payment/ecpay/handoff/${tokenOf(second.body.data.handoffUrl)}`,
      );

      // Then
      expect(res.status).toBe(410);
      expect(res.text).not.toContain('CheckMacValue');
    });

    it('LINE Pay 요청 중 다른 탭이 새 시도를 시작하면 이전 시도를 되살리지 않는다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const variantId = await createVariant(10);
      const cartItemId = await addToCart(token, variantId, 1);
      const { orderId } = await createOrder(
        token,
        { cartItemIds: [cartItemId] },
        'LINE_PAY',
      );
      const linePay = app.get(ExternalLinePayService);
      let secondStarted = false;
      jest.spyOn(linePay, 'request').mockImplementation(async () => {
        // 첫 요청이 LINE Pay 를 기다리는 사이 두 번째 시도가 시작된다
        if (!secondStarted) {
          secondStarted = true;
          await startPayment(token, orderId);
        }

        return LinePayRequestResultDto.from({
          returnCode: '0000',
          returnMessage: 'Success.',
          info: {
            transactionId: TRANSACTION_ID,
            paymentUrl: {
              web: 'https://sandbox-web-pay.line.me/x',
              app: 'line://x',
            },
          },
        });
      });

      // When
      const first = await startPayment(token, orderId);

      // Then
      expect(first.status).toBe(409);
      const rows = await dataSource.query(
        `SELECT status FROM payment WHERE order_id = $1 ORDER BY id`,
        [orderId],
      );
      expect(rows.map((row: { status: string }) => row.status)).toEqual([
        'CANCELED',
        'REQUESTED',
      ]);
      expect(await stockOf(variantId)).toBe(9);
    });

    it('PG 로 넘기지 못하고 READY 로 남은 시도는 배치가 정리하고 재고를 돌려준다', async () => {
      // Given — 요청 중 프로세스가 죽었다
      const { token } = await signUpAndLogin();
      const variantId = await createVariant(10);
      const cartItemId = await addToCart(token, variantId, 1);
      const { orderId } = await createOrder(
        token,
        { cartItemIds: [cartItemId] },
        'LINE_PAY',
      );
      mockLinePayRequest();
      const start = await startPayment(token, orderId);
      await dataSource.query(
        `UPDATE payment SET status = 'READY', requested_at = NOW() - interval '11 minutes' WHERE id = $1`,
        [start.body.data.paymentId],
      );

      // When
      await app.get(PaymentBatchService).expireStaleReady();

      // Then
      expect((await paymentRow(start.body.data.paymentId)).status).toBe(
        'EXPIRED',
      );
      expect(await stockOf(variantId)).toBe(10);
    });

    it('Confirm 이 0000 이 아니어도 상태 조회가 완료(0123)면 PAID 로 본다', async () => {
      // Given
      const started = await linePayStarted();
      jest
        .spyOn(app.get(ExternalLinePayService), 'confirm')
        .mockResolvedValue(linePayResult('1172', 'Existing same orderId'));
      jest
        .spyOn(app.get(ExternalLinePayService), 'checkStatus')
        .mockResolvedValue(linePayResult('0123', 'Completed'));

      // When
      await request(app.getHttpServer()).get(
        `/payment/linepay/confirm?transactionId=${TRANSACTION_ID}&orderId=${started.tradeNo}`,
      );

      // Then
      expect((await orderRow(started.orderId)).status).toBe('PAID');
    });

    it('사용자 Confirm 이 진행 중이면 배치는 같은 시도를 Confirm 하지 않는다', async () => {
      // Given — 사용자 쪽이 락을 잡고 있다
      const started = await linePayStarted();
      await app
        .get(CacheService)
        .setIfAbsent(`linepay_confirm_lock:${started.paymentId}`, 'user', 90);
      await dataSource.query(
        `UPDATE payment SET requested_at = NOW() - interval '15 minutes' WHERE id = $1`,
        [started.paymentId],
      );
      jest
        .spyOn(app.get(ExternalLinePayService), 'checkStatus')
        .mockResolvedValue(linePayResult('0110', 'Authorized'));
      const confirmSpy = jest.spyOn(app.get(ExternalLinePayService), 'confirm');

      // When
      await app.get(PaymentBatchService).reconcileLinePay();

      // Then
      expect(confirmSpy).not.toHaveBeenCalled();
    });
  });

  describe('배치 — ECPay 이탈 · 오래된 주문', () => {
    it('결제창을 열지도 않고 30분이 지나면 만료하고 재고를 돌려준다', async () => {
      // Given
      const started = await ecpayStarted({ stock: 10, quantity: 2 });
      await dataSource.query(
        `UPDATE payment SET requested_at = NOW() - interval '31 minutes' WHERE id = $1`,
        [started.paymentId],
      );
      const querySpy = jest.spyOn(
        app.get(ExternalEcpayService),
        'queryTradeInfo',
      );

      // When
      await app.get(PaymentBatchService).reconcileEcpay();

      // Then
      expect(querySpy).not.toHaveBeenCalled();
      expect((await paymentRow(started.paymentId)).status).toBe('EXPIRED');
      expect(await stockOf(started.variantId)).toBe(10);
      expect((await orderRow(started.orderId)).status).toBe('PENDING');
    });

    it('결제창을 연 건은 ECPay 에 물어보고, 결제됐으면 PAID 로 메운다', async () => {
      // Given — ReturnURL 을 놓쳤다
      const started = await ecpayStarted();
      await dataSource.query(
        `UPDATE payment SET requested_at = NOW() - interval '90 minutes', handoff_opened_at = NOW() - interval '61 minutes' WHERE id = $1`,
        [started.paymentId],
      );
      jest
        .spyOn(app.get(ExternalEcpayService), 'queryTradeInfo')
        .mockResolvedValue(
          EcpayTradeInfoDto.from({
            TradeStatus: '1',
            TradeAmt: String(started.totalAmount),
            TradeNo: '2510269999999999',
            PaymentType: 'Credit_CreditCard',
            PaymentDate: '2026/10/26 12:34:56',
          }),
        );

      // When
      await app.get(PaymentBatchService).reconcileEcpay();

      // Then
      expect((await orderRow(started.orderId)).status).toBe('PAID');
      expect((await paymentRow(started.paymentId)).pg_transaction_id).toBe(
        '2510269999999999',
      );
    });

    it('결제 없이 24시간 넘은 PENDING 주문은 취소한다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const variantId = await createVariant(10);
      const cartItemId = await addToCart(token, variantId, 1);
      const { orderId } = await createOrder(token, {
        cartItemIds: [cartItemId],
      });
      await dataSource.query(
        `UPDATE "order" SET create_date = (NOW() AT TIME ZONE 'UTC') - interval '25 hours' WHERE id = $1`,
        [orderId],
      );

      // When
      await app.get(PaymentBatchService).cancelStaleOrders();

      // Then
      expect((await orderRow(orderId)).status).toBe('CANCELED');
    });
  });
});

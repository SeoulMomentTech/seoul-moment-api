import { CacheService } from '@app/cache/cache.service';
import {
  EcpayInvoiceCheckDto,
  EcpayInvoiceResultDto,
} from '@app/external/ecpay/ecpay-invoice.dto';
import { ExternalEcpayInvoiceService } from '@app/external/ecpay/ecpay-invoice.service';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { InvoiceIssueService } from '../apps/api/src/module/invoice/invoice-issue.service';

const USER_AUTH_BASE = '/user/auth';
const ORDER_BASE = '/user/order';
const STOREFRONT = 'http://storefront.test';

describe('주문서 — 전자발표 · 편의점 픽업 (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let invoiceClient: ExternalEcpayInvoiceService;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득 (최초 1회만 부트스트랩)
    app = await getTestApp();
    dataSource = getDataSource(app);
    invoiceClient = app.get(ExternalEcpayInvoiceService);
  }, 60_000);

  beforeEach(async () => {
    // 본섬 60 / 외섬 100 / 무료배송 없음
    await dataSource.query(
      `INSERT INTO shipping_policy
         (id, base_fee, remote_island_fee, remote_island_promotion, free_shipping_threshold)
       VALUES (1, 60, 100, false, 100000)`,
    );
  });

  afterEach(async () => {
    jest.restoreAllMocks();

    const cache = app.get(CacheService);
    for (const prefix of ['invoice_check', 'cvs_map', 'cvs_store']) {
      for (const key of await cache.scan(prefix)) {
        await cache.del(key);
      }
    }

    await truncateTables(dataSource, [
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
  async function signUpAndLogin(): Promise<{
    userId: number;
    token: string;
    email: string;
  }> {
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
    const userId = rows[0].id as number;

    await dataSource.query(
      `INSERT INTO user_profile (user_id, name, postal_code, city, district, detail_address)
       VALUES ($1, '李佳蓉', '110', '臺北市', '信義區', '松高路 11號 5樓')`,
      [userId],
    );
    await dataSource.query(`UPDATE "user" SET phone = $1 WHERE id = $2`, [
      '+886 912 345 678',
      userId,
    ]);

    return { userId, token: loginRes.body.data.token, email: body.email };
  }

  async function createVariant(price = 1000): Promise<number> {
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
       VALUES ($1, $2, 10, 'ACTIVE') RETURNING id`,
      [itemRows[0].id, faker.string.alphanumeric(12).toUpperCase()],
    );

    return variantRows[0].id as number;
  }

  function createOrder(token: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post(ORDER_BASE)
      .set('Authorization', `Bearer ${token}`)
      .set('Accept-language', 'ko')
      .send({ paymentMethod: 'ECPAY', ...body });
  }

  async function homeOrder(token: string, invoice?: Record<string, unknown>) {
    const variantId = await createVariant();

    return createOrder(token, {
      items: [{ productVariantId: variantId, quantity: 1 }],
      useDefaultShipping: true,
      ...(invoice ? { invoice } : {}),
    });
  }

  async function invoiceRow(orderId: number) {
    const rows = await dataSource.query(
      `SELECT * FROM order_invoice WHERE order_id = $1`,
      [orderId],
    );

    return rows[0];
  }

  function checkResult(exists: boolean, rtnCode = 1, name?: string) {
    return EcpayInvoiceCheckDto.from({
      RtnCode: rtnCode,
      IsExist: exists ? 'Y' : 'N',
      OrganName: name,
    });
  }

  /** 전자지도를 열고 ECPay 가 매장을 돌려준 것처럼 POST 한다 */
  async function pickStore(
    chain = 'UNIMART',
    reply: Record<string, string> = {},
  ): Promise<string> {
    const map = await request(app.getHttpServer())
      .get('/logistics/cvs/map')
      .query({ chain, returnUrl: `${STOREFRONT}/order/checkout` })
      .expect(200);
    const nonce = /name="ExtraData" value="([0-9a-f]{20})"/.exec(map.text)?.[1];

    const res = await request(app.getHttpServer())
      .post('/logistics/cvs/map/reply')
      .type('form')
      .send({
        MerchantID: '2000933',
        MerchantTradeNo: '',
        LogisticsSubType: `${chain}C2C`,
        CVSStoreID: '131386',
        CVSStoreName: '建盛門市',
        CVSAddress: '台北市中正區重慶南路一段122號',
        CVSTelephone: '',
        CVSOutSide: '0',
        ExtraData: nonce,
        ...reply,
      })
      .expect(303);

    return new URL(res.headers.location).searchParams.get('cvsStoreToken');
  }

  // -------------------------------------------------------------------------
  describe('전자발표 선택', () => {
    it('생략하면 ECPay 회원 載具로 회원 이메일·휴대폰을 박아 둔다', async () => {
      // Given
      const { token, email } = await signUpAndLogin();

      // When
      const res = await homeOrder(token);

      // Then
      expect(res.status).toBe(201);
      const row = await invoiceRow(res.body.data.orderId);
      expect(row).toMatchObject({
        type: 'MEMBER_CARRIER',
        status: 'PENDING',
        customer_email: email,
        customer_phone: '0912345678',
        carrier_num: null,
      });
    });

    it('휴대폰 바코드는 ECPay 확인을 거쳐 저장하고 주문 상세에 나온다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const checkSpy = jest
        .spyOn(invoiceClient, 'checkBarcode')
        .mockResolvedValue(checkResult(true));

      // When — 소문자로 보내도 대문자로 저장한다
      const res = await homeOrder(token, {
        type: 'MOBILE_BARCODE',
        carrierNum: '/abc1234',
      });

      // Then
      expect(res.status).toBe(201);
      expect(checkSpy).toHaveBeenCalledWith('/ABC1234');
      const detail = await request(app.getHttpServer())
        .get(`${ORDER_BASE}/${res.body.data.orderId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(detail.body.data.invoice).toMatchObject({
        type: 'MOBILE_BARCODE',
        status: 'PENDING',
        carrierNum: '/ABC1234',
        invoiceNo: null,
      });
    });

    it('재정부 장애로 바코드를 확인 못 하면 형식만 맞을 때 받아들인다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      jest
        .spyOn(invoiceClient, 'checkBarcode')
        .mockResolvedValue(checkResult(false, 9000001));

      // When
      const res = await homeOrder(token, {
        type: 'MOBILE_BARCODE',
        carrierNum: '/ABC1234',
      });

      // Then
      expect(res.status).toBe(201);
    });

    it('형식이 틀린 바코드·自然人憑證은 400', async () => {
      const { token } = await signUpAndLogin();

      const barcode = await homeOrder(token, {
        type: 'MOBILE_BARCODE',
        carrierNum: 'ABC1234',
      });
      const cert = await homeOrder(token, {
        type: 'CITIZEN_CERT',
        carrierNum: 'A123',
      });

      expect(barcode.status).toBe(400);
      expect(cert.status).toBe(400);
    });

    it('없는 愛心碼면 400 — ECPay 발행은 코드를 검사하지 않아서 서버가 막는다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      jest
        .spyOn(invoiceClient, 'checkLoveCode')
        .mockResolvedValue(checkResult(false));

      // When
      const res = await homeOrder(token, {
        type: 'DONATION',
        loveCode: '1680000',
      });

      // Then
      expect(res.status).toBe(400);
      expect(res.body.data).toEqual({ field: 'loveCode' });
    });

    it('統編은 검사코드를 보고, 맞으면 회사명과 함께 저장한다', async () => {
      // Given
      const { token } = await signUpAndLogin();

      // When
      const bad = await homeOrder(token, {
        type: 'COMPANY',
        companyTaxId: '12345678',
        companyName: '測試公司',
      });
      const good = await homeOrder(token, {
        type: 'COMPANY',
        companyTaxId: '97025978',
        companyName: '測試公司',
        carrierNum: '/IGNORED',
      });

      // Then
      expect(bad.status).toBe(400);
      expect(good.status).toBe(201);
      expect(await invoiceRow(good.body.data.orderId)).toMatchObject({
        type: 'COMPANY',
        company_tax_id: '97025978',
        company_name: '測試公司',
        carrier_num: null,
      });
    });

    it('확인 API 는 같은 값을 하루 동안 기억해 ECPay 에 다시 묻지 않는다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const spy = jest
        .spyOn(invoiceClient, 'checkLoveCode')
        .mockResolvedValue(
          checkResult(true, 1, '財團法人台灣兒童暨家庭扶助基金會'),
        );

      // When
      const first = await request(app.getHttpServer())
        .get('/user/invoice/love-code/check?code=168001')
        .set('Authorization', `Bearer ${token}`);
      const second = await request(app.getHttpServer())
        .get('/user/invoice/love-code/check?code=168001')
        .set('Authorization', `Bearer ${token}`);

      // Then
      expect(first.body.data).toEqual({
        valid: true,
        verified: true,
        name: '財團法人台灣兒童暨家庭扶助基金會',
      });
      expect(second.body.data.valid).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('전자발표 발행', () => {
    async function paidOrder(invoice?: Record<string, unknown>) {
      const { token } = await signUpAndLogin();
      const res = await homeOrder(token, invoice);
      const orderId = res.body.data.orderId as number;
      await dataSource.query(
        `UPDATE "order" SET status = 'PAID' WHERE id = $1`,
        [orderId],
      );

      return orderId;
    }

    function issued(invoiceNo = 'LY74004967') {
      return EcpayInvoiceResultDto.fromIssue({
        RtnCode: 1,
        RtnMsg: '開立發票成功',
        InvoiceNo: invoiceNo,
        InvoiceDate: '2026-10-26 15:30:00',
        RandomNumber: '3204',
      });
    }

    it('결제된 주문은 발행하고 발표번호·랜덤번호를 남긴다', async () => {
      // Given
      const orderId = await paidOrder();
      const issueSpy = jest
        .spyOn(invoiceClient, 'issue')
        .mockResolvedValue(issued());

      // When
      await app.get(InvoiceIssueService).issueForOrder(orderId);

      // Then
      const row = await invoiceRow(orderId);
      expect(row).toMatchObject({
        status: 'ISSUED',
        invoice_no: 'LY74004967',
        random_number: '3204',
        attempt_count: 1,
      });
      expect(row.invoice_date.toISOString()).toBe('2026-10-26T07:30:00.000Z');
      const [data] = issueSpy.mock.calls[0];
      expect(data.RelateNumber).toBe(row.relate_number);
      expect(data.SalesAmount).toBe(1060);
    });

    it('발표 행이 없는 옛 주문도 결제되면 ECPay 회원 載具로 발행한다', async () => {
      // Given — 이 기능 전에 만든 주문
      const orderId = await paidOrder();
      await dataSource.query(`DELETE FROM order_invoice WHERE order_id = $1`, [
        orderId,
      ]);
      jest
        .spyOn(invoiceClient, 'issue')
        .mockResolvedValue(issued('LY74004999'));

      // When
      await app.get(InvoiceIssueService).issueForOrder(orderId);

      // Then
      expect(await invoiceRow(orderId)).toMatchObject({
        type: 'MEMBER_CARRIER',
        status: 'ISSUED',
        invoice_no: 'LY74004999',
        customer_phone: '0912345678',
      });
    });

    it('결제 전 주문은 발행하지 않는다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const res = await homeOrder(token);
      const issueSpy = jest.spyOn(invoiceClient, 'issue');

      // When
      await app.get(InvoiceIssueService).issueForOrder(res.body.data.orderId);

      // Then
      expect(issueSpy).not.toHaveBeenCalled();
    });

    it('응답을 못 받은 뒤 재시도는 같은 RelateNumber 로 조회부터 해서 이중 발행하지 않는다', async () => {
      // Given — 첫 시도는 타임아웃
      const orderId = await paidOrder();
      const issueSpy = jest
        .spyOn(invoiceClient, 'issue')
        .mockRejectedValueOnce(new Error('timeout'));
      await app.get(InvoiceIssueService).issueForOrder(orderId);
      const failed = await invoiceRow(orderId);
      expect(failed).toMatchObject({
        status: 'FAILED',
        failure_code: 'NETWORK',
      });

      // 실제로는 ECPay 에 발행돼 있었다
      jest.spyOn(invoiceClient, 'getIssue').mockResolvedValue(
        EcpayInvoiceResultDto.fromGetIssue({
          RtnCode: 1,
          IIS_Number: 'LY74004968',
          IIS_Create_Date: '2026-10-26 15:31:00',
          IIS_Random_Number: '1111',
        }),
      );

      // When — 배치 재시도
      // 재시도 간격(첫 실패 뒤 5분)이 지난 시점의 배치
      await app
        .get(InvoiceIssueService)
        .retryPending(new Date(Date.now() + 6 * 60 * 1000));

      // Then
      expect(issueSpy).toHaveBeenCalledTimes(1);
      expect(await invoiceRow(orderId)).toMatchObject({
        status: 'ISSUED',
        invoice_no: 'LY74004968',
        relate_number: failed.relate_number,
      });
    });

    it('ECPay 가 거절하면 FAILED 로 사유를 남긴다', async () => {
      // Given
      const orderId = await paidOrder();
      jest.spyOn(invoiceClient, 'issue').mockResolvedValue(
        EcpayInvoiceResultDto.fromIssue({
          RtnCode: 5000032,
          RtnMsg: '手機條碼格式錯誤',
        }),
      );

      // When
      await app.get(InvoiceIssueService).issueForOrder(orderId);

      // Then
      expect(await invoiceRow(orderId)).toMatchObject({
        status: 'FAILED',
        failure_code: '5000032',
        failure_message: '手機條碼格式錯誤',
      });
    });
  });

  describe('편의점 픽업', () => {
    it('전자지도를 열면 ECPay 지도로 auto-submit 하는 페이지를 준다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .get('/logistics/cvs/map')
        .query({ chain: 'FAMI', returnUrl: `${STOREFRONT}/order/checkout` })
        .set('User-Agent', 'Mozilla/5.0 (iPhone) Line/14.0.0')
        .expect(200);

      // Then
      expect(res.text).toContain(
        'action="https://logistics-stage.ecpay.com.tw/Express/map"',
      );
      expect(res.text).toContain('name="LogisticsSubType" value="FAMIC2C"');
      expect(res.text).toContain('name="IsCollection" value="N"');
      expect(res.text).toContain('name="Device" value="1"');
      expect(res.text).toContain(
        'name="ServerReplyURL" value="http://localhost/logistics/cvs/map/reply"',
      );
    });

    it('같은 nonce 로 매장을 다시 보내도 받지 않는다 (한 번만 쓴다)', async () => {
      // Given
      const map = await request(app.getHttpServer())
        .get('/logistics/cvs/map')
        .query({ chain: 'UNIMART', returnUrl: `${STOREFRONT}/order/checkout` })
        .expect(200);
      const nonce = /name="ExtraData" value="([0-9a-f]{20})"/.exec(
        map.text,
      )?.[1];
      const reply = {
        CVSStoreID: '131386',
        CVSStoreName: 'A',
        CVSAddress: '台北市中正區重慶南路一段122號',
        ExtraData: nonce,
      };

      // When
      const first = await request(app.getHttpServer())
        .post('/logistics/cvs/map/reply')
        .type('form')
        .send(reply);
      const second = await request(app.getHttpServer())
        .post('/logistics/cvs/map/reply')
        .type('form')
        .send({ ...reply, CVSStoreName: 'B' });

      // Then
      expect(first.status).toBe(303);
      expect(second.status).toBe(200);
      expect(second.text).toContain('門市選擇已逾時');
    });

    it('매장 주소가 외섬이면 CVSOutSide=0 이어도 외섬 요금이다 (응답에 서명이 없어서)', async () => {
      // Given — 澎湖縣 은 외섬 규칙에 있다
      await dataSource.query(
        `INSERT INTO shipping_remote_area (city, district, is_active) VALUES ('澎湖縣', NULL, true)`,
      );
      const { token } = await signUpAndLogin();
      const variantId = await createVariant();
      const storeToken = await pickStore('UNIMART', {
        CVSAddress: '澎湖縣馬公市中正路1號',
        CVSOutSide: '0',
      });

      // When
      const res = await createOrder(token, {
        items: [{ productVariantId: variantId, quantity: 1 }],
        shippingType: 'CVS',
        cvsPickup: { storeToken, recipientName: '李佳蓉', phone: '0912345678' },
      });

      // Then
      expect(res.status).toBe(201);
      expect(res.body.data.totalAmount).toBe(1100);
    });

    it('형식이 틀린 매장 응답은 받지 않는다', async () => {
      // Given
      const map = await request(app.getHttpServer())
        .get('/logistics/cvs/map')
        .query({ chain: 'UNIMART' })
        .expect(200);
      const nonce = /name="ExtraData" value="([0-9a-f]{20})"/.exec(
        map.text,
      )?.[1];

      // When
      const res = await request(app.getHttpServer())
        .post('/logistics/cvs/map/reply')
        .type('form')
        .send({
          CVSStoreID: '131386',
          CVSStoreName: 'x'.repeat(51),
          ExtraData: nonce,
        });

      // Then
      expect(res.text).toContain('門市選擇已逾時');
    });

    it('없는 체인은 400', async () => {
      await request(app.getHttpServer())
        .get('/logistics/cvs/map')
        .query({ chain: 'OKMART' })
        .expect(400);
    });

    it('고른 매장은 주문서로 돌려보내고 토큰으로 조회할 수 있다', async () => {
      // When
      const token = await pickStore();
      const res = await request(app.getHttpServer())
        .get(`/logistics/cvs/store/${token}`)
        .expect(200);

      // Then
      expect(res.body.data).toEqual({
        storeToken: token,
        chain: 'UNIMART',
        logisticsSubType: 'UNIMARTC2C',
        storeId: '131386',
        storeName: '建盛門市',
        storeAddress: '台北市中正區重慶南路一段122號',
        storeTelephone: null,
        isOutsideIsland: false,
      });
    });

    it('프론트 주소가 아닌 returnUrl 로는 돌려보내지 않는다 (열린 리다이렉트 방지)', async () => {
      // Given
      const map = await request(app.getHttpServer())
        .get('/logistics/cvs/map')
        .query({ chain: 'UNIMART', returnUrl: 'https://evil.example/steal' })
        .expect(200);
      const nonce = /name="ExtraData" value="([0-9a-f]{20})"/.exec(
        map.text,
      )?.[1];

      // When
      const res = await request(app.getHttpServer())
        .post('/logistics/cvs/map/reply')
        .type('form')
        .send({
          CVSStoreID: '131386',
          CVSStoreName: 'x',
          CVSAddress: '台北市中正區重慶南路一段122號',
          ExtraData: nonce,
        });

      // Then
      expect(res.status).toBe(200);
      expect(res.headers.location).toBeUndefined();
    });

    /** returnUrl 로 지도를 열고 매장을 돌려받아 응답을 준다 */
    async function replyWithReturnUrl(returnUrl: string) {
      const map = await request(app.getHttpServer())
        .get('/logistics/cvs/map')
        .query({ chain: 'UNIMART', returnUrl })
        .expect(200);
      const nonce = /name="ExtraData" value="([0-9a-f]{20})"/.exec(
        map.text,
      )?.[1];

      return request(app.getHttpServer())
        .post('/logistics/cvs/map/reply')
        .type('form')
        .send({
          CVSStoreID: '131386',
          CVSStoreName: '建盛門市',
          CVSAddress: '台北市中正區重慶南路一段122號',
          ExtraData: nonce,
        });
    }

    it('로컬 프론트(localhost) returnUrl 로도 돌려보내고, 기존 쿼리는 유지한다', async () => {
      // Given - 프론트 로컬 개발 주소 (포트 무관)
      const returnUrl = 'http://localhost:5173/order?query=dawdwad';

      // When
      const res = await replyWithReturnUrl(returnUrl);

      // Then
      expect(res.status).toBe(303);
      const location = new URL(res.headers.location);
      expect(location.origin).toBe('http://localhost:5173');
      expect(location.pathname).toBe('/order');
      expect(location.searchParams.get('query')).toBe('dawdwad');
      expect(location.searchParams.get('cvsStoreToken')).toMatch(
        /^[0-9a-f]{20}$/,
      );
    });

    it.each([
      'http://localhost.evil.example/steal',
      'http://localhost@evil.example/steal',
      'javascript://localhost/%0aalert(1)',
    ])(
      'localhost 처럼 보이는 남의 주소로는 돌려보내지 않는다: %s',
      async (url) => {
        const res = await replyWithReturnUrl(url);

        expect(res.status).toBe(200);
        expect(res.headers.location).toBeUndefined();
      },
    );

    it('모르는 nonce 로 온 매장은 받지 않는다', async () => {
      const res = await request(app.getHttpServer())
        .post('/logistics/cvs/map/reply')
        .type('form')
        .send({ CVSStoreID: '131386', ExtraData: 'ffffffffffffffffffff' });

      expect(res.status).toBe(200);
      expect(res.text).toContain('門市選擇已逾時');
    });

    it('편의점 주문은 매장을 배송지로 박고 주소는 비운다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const variantId = await createVariant();
      const storeToken = await pickStore();

      // When
      const res = await createOrder(token, {
        items: [{ productVariantId: variantId, quantity: 1 }],
        shippingType: 'CVS',
        cvsPickup: { storeToken, recipientName: '李佳蓉', phone: '0912345678' },
      });

      // Then
      expect(res.status).toBe(201);
      expect(res.body.data.totalAmount).toBe(1060);

      const detail = await request(app.getHttpServer())
        .get(`${ORDER_BASE}/${res.body.data.orderId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(detail.body.data.shipping).toMatchObject({
        shippingType: 'CVS',
        recipientName: '李佳蓉',
        phone: '0912345678',
        city: null,
        detailAddress: null,
        cvsStore: {
          logisticsSubType: 'UNIMARTC2C',
          storeId: '131386',
          storeName: '建盛門市',
          isOutsideIsland: false,
        },
      });
    });

    it('離島 매장이면 외섬 배송비가 붙는다 (미리보기·주문 모두)', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const variantId = await createVariant();
      const storeToken = await pickStore('UNIMART', { CVSOutSide: '1' });
      const items = [{ productVariantId: variantId, quantity: 1 }];

      // When
      const preview = await request(app.getHttpServer())
        .post(`${ORDER_BASE}/preview`)
        .set('Authorization', `Bearer ${token}`)
        .set('Accept-language', 'ko')
        .send({ items, shippingType: 'CVS', cvsStoreToken: storeToken });
      const order = await createOrder(token, {
        items,
        shippingType: 'CVS',
        cvsPickup: {
          storeToken,
          recipientName: 'WANGXIAO',
          phone: '0912345678',
        },
      });

      // Then
      expect(preview.body.data).toMatchObject({
        shippingFee: 100,
        isRemoteIsland: true,
        isShippingEstimated: false,
      });
      expect(order.status).toBe(201);
      expect(order.body.data.totalAmount).toBe(1100);
    });

    it('수령인 이름·휴대폰이 편의점 규칙에 안 맞으면 400', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const variantId = await createVariant();
      const storeToken = await pickStore();
      const order = (cvsPickup: Record<string, string>) =>
        createOrder(token, {
          items: [{ productVariantId: variantId, quantity: 1 }],
          shippingType: 'CVS',
          cvsPickup,
        });

      // Then
      expect(
        (await order({ storeToken, recipientName: '李', phone: '0912345678' }))
          .status,
      ).toBe(400);
      expect(
        (
          await order({
            storeToken,
            recipientName: 'Wang Xiao',
            phone: '0912345678',
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await order({
            storeToken,
            recipientName: '李佳蓉',
            phone: '+886912345678',
          })
        ).status,
      ).toBe(400);
    });

    it('매장 토큰이 없거나 만료됐으면 400 — 다시 고르게 한다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const variantId = await createVariant();

      // When
      const res = await createOrder(token, {
        items: [{ productVariantId: variantId, quantity: 1 }],
        shippingType: 'CVS',
        cvsPickup: {
          storeToken: 'ffffffffffffffffffff',
          recipientName: '李佳蓉',
          phone: '0912345678',
        },
      });

      // Then
      expect(res.status).toBe(400);
      expect(res.body.data).toEqual({ field: 'cvsPickup.storeToken' });
    });

    it('CVS 인데 cvsPickup 이 없으면 400, HOME 은 useDefaultShipping 이 여전히 필수다', async () => {
      // Given
      const { token } = await signUpAndLogin();
      const variantId = await createVariant();
      const items = [{ productVariantId: variantId, quantity: 1 }];

      // Then
      expect(
        (await createOrder(token, { items, shippingType: 'CVS' })).status,
      ).toBe(400);
      expect((await createOrder(token, { items })).status).toBe(400);
    });
  });
});

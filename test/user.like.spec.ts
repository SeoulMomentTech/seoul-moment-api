import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

const USER_AUTH_BASE = '/user/auth';
const LIKE_BASE = '/user/like';

describe('UserLikeController (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득 (최초 1회만 부트스트랩)
    app = await getTestApp();
    dataSource = getDataSource(app);
  }, 60_000);

  afterEach(async () => {
    await truncateTables(dataSource, [
      'user_brand_like',
      'user_product_like',
      'user_sns',
      'user_fit',
      'user_profile',
      '"user"',
      'product_item',
      'product',
      'brand',
      'category',
    ]);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // -------------------------------------------------------------------------
  // 헬퍼: signup + login → oneTimeToken 획득 (login 응답의 token이 ONE_TIME_TOKEN)
  // -------------------------------------------------------------------------
  async function signUpAndLogin(): Promise<{
    userId: number;
    oneTimeToken: string;
  }> {
    const body = {
      email: faker.internet.email().toLowerCase(),
      password: faker.internet.password({ length: 12 }),
      phone: faker.string.numeric(11),
      personalInfoAgreeDate: '2025-01-01 12:00:00',
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

  // -------------------------------------------------------------------------
  // 헬퍼: 카테고리 / 브랜드 / 상품 / 상품아이템 시드
  // -------------------------------------------------------------------------
  async function createCategory(): Promise<number> {
    const rows = await dataSource.query(
      `INSERT INTO category (sort_order) VALUES (1) RETURNING id`,
    );
    return rows[0].id;
  }

  async function createBrand(): Promise<number> {
    const categoryId = await createCategory();
    const rows = await dataSource.query(
      `INSERT INTO brand (category_id, english_name) VALUES ($1, $2) RETURNING id`,
      [categoryId, faker.company.name()],
    );
    return rows[0].id;
  }

  async function createProductItem(): Promise<{
    brandId: number;
    productItemId: number;
  }> {
    const brandId = await createBrand();
    const categoryRow = await dataSource.query(
      `SELECT id FROM category LIMIT 1`,
    );
    const categoryId = categoryRow[0].id;

    const productRows = await dataSource.query(
      `INSERT INTO product (brand_id, category_id) VALUES ($1, $2) RETURNING id`,
      [brandId, categoryId],
    );
    const productId = productRows[0].id;

    const itemRows = await dataSource.query(
      `INSERT INTO product_item (product_id, price) VALUES ($1, $2) RETURNING id`,
      [productId, 1000],
    );

    return { brandId, productItemId: itemRows[0].id };
  }

  // -------------------------------------------------------------------------
  // POST /user/like/product
  // -------------------------------------------------------------------------
  describe('POST /user/like/product', () => {
    it('정상 좋아요 추가 시 204를 반환하고 DB에 레코드가 생성된다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const { productItemId } = await createProductItem();

      // When
      const res = await request(app.getHttpServer())
        .post(`${LIKE_BASE}/product`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ productItemId });

      // Then
      expect(res.status).toBe(204);
      const rows = await dataSource.query(
        `SELECT user_id, product_item_id FROM user_product_like
         WHERE user_id = $1 AND product_item_id = $2`,
        [userId, productItemId],
      );
      expect(rows).toHaveLength(1);
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // Given
      const { productItemId } = await createProductItem();

      // When
      const res = await request(app.getHttpServer())
        .post(`${LIKE_BASE}/product`)
        .send({ productItemId });

      // Then
      expect(res.status).toBe(401);
    });

    it('productItemId가 누락되면 400을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .post(`${LIKE_BASE}/product`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({});

      // Then
      expect(res.status).toBe(400);
    });

    it('productItemId가 0 이하면 400을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .post(`${LIKE_BASE}/product`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ productItemId: 0 });

      // Then
      expect(res.status).toBe(400);
    });

    it('존재하지 않는 productItemId면 404를 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .post(`${LIKE_BASE}/product`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ productItemId: 999_999 });

      // Then
      expect(res.status).toBe(404);
    });

    it('이미 좋아요 한 상품아이템이면 409를 반환한다', async () => {
      // Given - 한 번 좋아요 등록
      const { oneTimeToken } = await signUpAndLogin();
      const { productItemId } = await createProductItem();
      const first = await request(app.getHttpServer())
        .post(`${LIKE_BASE}/product`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ productItemId });
      expect(first.status).toBe(204);

      // When - 같은 상품아이템에 다시 좋아요 시도
      const res = await request(app.getHttpServer())
        .post(`${LIKE_BASE}/product`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ productItemId });

      // Then
      expect(res.status).toBe(409);
    });
  });

  // -------------------------------------------------------------------------
  // POST /user/like/brand
  // -------------------------------------------------------------------------
  describe('POST /user/like/brand', () => {
    it('정상 좋아요 추가 시 204를 반환하고 DB에 레코드가 생성된다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const brandId = await createBrand();

      // When
      const res = await request(app.getHttpServer())
        .post(`${LIKE_BASE}/brand`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ brandId });

      // Then
      expect(res.status).toBe(204);
      const rows = await dataSource.query(
        `SELECT user_id, brand_id FROM user_brand_like
         WHERE user_id = $1 AND brand_id = $2`,
        [userId, brandId],
      );
      expect(rows).toHaveLength(1);
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // Given
      const brandId = await createBrand();

      // When
      const res = await request(app.getHttpServer())
        .post(`${LIKE_BASE}/brand`)
        .send({ brandId });

      // Then
      expect(res.status).toBe(401);
    });

    it('brandId가 누락되면 400을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .post(`${LIKE_BASE}/brand`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({});

      // Then
      expect(res.status).toBe(400);
    });

    it('존재하지 않는 brandId면 404를 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .post(`${LIKE_BASE}/brand`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ brandId: 999_999 });

      // Then
      expect(res.status).toBe(404);
    });

    it('이미 좋아요 한 브랜드면 409를 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const brandId = await createBrand();
      const first = await request(app.getHttpServer())
        .post(`${LIKE_BASE}/brand`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ brandId });
      expect(first.status).toBe(204);

      // When
      const res = await request(app.getHttpServer())
        .post(`${LIKE_BASE}/brand`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ brandId });

      // Then
      expect(res.status).toBe(409);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /user/like/product/:id
  // -------------------------------------------------------------------------
  describe('DELETE /user/like/product/:id', () => {
    it('정상 좋아요 삭제 시 204를 반환하고 DB에서 레코드가 제거된다', async () => {
      // Given - 좋아요 등록
      const { userId, oneTimeToken } = await signUpAndLogin();
      const { productItemId } = await createProductItem();
      await request(app.getHttpServer())
        .post(`${LIKE_BASE}/product`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ productItemId });

      // When
      const res = await request(app.getHttpServer())
        .delete(`${LIKE_BASE}/product/${productItemId}`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(204);
      const rows = await dataSource.query(
        `SELECT user_id FROM user_product_like
         WHERE user_id = $1 AND product_item_id = $2`,
        [userId, productItemId],
      );
      expect(rows).toHaveLength(0);
    });

    it('좋아요가 없는 상태에서 삭제해도 204를 반환한다 (idempotent)', async () => {
      // Given - 좋아요 등록 없이 곧바로 삭제
      const { oneTimeToken } = await signUpAndLogin();
      const { productItemId } = await createProductItem();

      // When
      const res = await request(app.getHttpServer())
        .delete(`${LIKE_BASE}/product/${productItemId}`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(204);
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).delete(
        `${LIKE_BASE}/product/1`,
      );

      // Then
      expect(res.status).toBe(401);
    });

    it('id가 숫자가 아니면 404를 반환한다 (라우트 매칭 실패)', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .delete(`${LIKE_BASE}/product/not-a-number`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /user/like/brand/:id
  // -------------------------------------------------------------------------
  describe('DELETE /user/like/brand/:id', () => {
    it('정상 좋아요 삭제 시 204를 반환하고 DB에서 레코드가 제거된다', async () => {
      // Given - 좋아요 등록
      const { userId, oneTimeToken } = await signUpAndLogin();
      const brandId = await createBrand();
      await request(app.getHttpServer())
        .post(`${LIKE_BASE}/brand`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ brandId });

      // When
      const res = await request(app.getHttpServer())
        .delete(`${LIKE_BASE}/brand/${brandId}`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(204);
      const rows = await dataSource.query(
        `SELECT user_id FROM user_brand_like
         WHERE user_id = $1 AND brand_id = $2`,
        [userId, brandId],
      );
      expect(rows).toHaveLength(0);
    });

    it('좋아요가 없는 상태에서 삭제해도 204를 반환한다 (idempotent)', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const brandId = await createBrand();

      // When
      const res = await request(app.getHttpServer())
        .delete(`${LIKE_BASE}/brand/${brandId}`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(204);
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).delete(
        `${LIKE_BASE}/brand/1`,
      );

      // Then
      expect(res.status).toBe(401);
    });
  });
});

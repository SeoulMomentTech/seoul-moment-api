import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { LanguageCode } from '../libs/repository/src/enum/language.enum';

const USER_AUTH_BASE = '/user/auth';
const BANNER_BY_BRAND_BASE = '/product/banner/brand';

describe('GET /product/banner/brand (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    // Given - 앱/DataSource 획득
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
      'brand_mobile_banner_image',
      'brand_banner_image',
      'brand',
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
    const categoryId = categoryRows[0].id;
    const brandRows = await dataSource.query(
      `INSERT INTO brand (category_id, english_name, banner_image_url)
       VALUES ($1, $2, $3) RETURNING id`,
      [categoryId, faker.company.name(), `/brands/${faker.string.uuid()}.jpg`],
    );
    return brandRows[0].id;
  }

  async function likeBrand(userId: number, brandId: number): Promise<void> {
    await dataSource.query(
      `INSERT INTO user_brand_like (user_id, brand_id) VALUES ($1, $2)`,
      [userId, brandId],
    );
  }

  // -------------------------------------------------------------------------
  // isLiked
  // -------------------------------------------------------------------------
  describe('isLiked 처리', () => {
    it('인증 없이 호출 시 isLiked는 false다', async () => {
      // Given
      const brandId = await createBrand();

      // When
      const res = await request(app.getHttpServer())
        .get(BANNER_BY_BRAND_BASE)
        .set('Accept-language', LanguageCode.KOREAN)
        .query({ brandId });

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(
        expect.objectContaining({
          brandId,
          isLiked: false,
        }),
      );
    });

    it('로그인했지만 해당 브랜드를 좋아요하지 않은 사용자는 isLiked가 false다', async () => {
      // Given - 좋아요 없는 사용자
      const { oneTimeToken } = await signUpAndLogin();
      const brandId = await createBrand();

      // When
      const res = await request(app.getHttpServer())
        .get(BANNER_BY_BRAND_BASE)
        .set('Accept-language', LanguageCode.KOREAN)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .query({ brandId });

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.isLiked).toBe(false);
    });

    it('해당 브랜드를 좋아요한 사용자는 isLiked가 true다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const brandId = await createBrand();
      await likeBrand(userId, brandId);

      // When
      const res = await request(app.getHttpServer())
        .get(BANNER_BY_BRAND_BASE)
        .set('Accept-language', LanguageCode.KOREAN)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .query({ brandId });

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.isLiked).toBe(true);
    });

    it('다른 사용자가 좋아요해도 요청자의 isLiked는 영향받지 않는다', async () => {
      // Given - other 가 좋아요, me 는 좋아요 안함
      const other = await signUpAndLogin();
      const me = await signUpAndLogin();
      const brandId = await createBrand();
      await likeBrand(other.userId, brandId);

      // When
      const res = await request(app.getHttpServer())
        .get(BANNER_BY_BRAND_BASE)
        .set('Accept-language', LanguageCode.KOREAN)
        .set('Authorization', `Bearer ${me.oneTimeToken}`)
        .query({ brandId });

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.isLiked).toBe(false);
    });

    it('잘못된 토큰이면 익명으로 처리되어 isLiked가 false다', async () => {
      // Given
      const brandId = await createBrand();

      // When
      const res = await request(app.getHttpServer())
        .get(BANNER_BY_BRAND_BASE)
        .set('Accept-language', LanguageCode.KOREAN)
        .set('Authorization', 'Bearer not-a-real-token')
        .query({ brandId });

      // Then - OptionalUserGuard는 토큰 실패 시 익명으로 통과
      expect(res.status).toBe(200);
      expect(res.body.data.isLiked).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 일반 동작
  // -------------------------------------------------------------------------
  describe('일반 동작', () => {
    it('존재하지 않는 brandId면 404를 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .get(BANNER_BY_BRAND_BASE)
        .set('Accept-language', LanguageCode.KOREAN)
        .query({ brandId: 99999999 });

      // Then
      expect(res.status).toBe(404);
    });

    it('brandId가 누락되면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .get(BANNER_BY_BRAND_BASE)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(400);
    });
  });
});

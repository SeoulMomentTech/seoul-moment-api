import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { EntityType } from '../libs/repository/src/enum/entity.enum';
import { LanguageCode } from '../libs/repository/src/enum/language.enum';
import { LanguageRepositoryService } from '../libs/repository/src/service/language.repository.service';

const USER_AUTH_BASE = '/user/auth';
const LIKE_BASE = '/user/like';

describe('UserLikeController (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let languageRepositoryService: LanguageRepositoryService;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득 (최초 1회만 부트스트랩)
    app = await getTestApp();
    dataSource = getDataSource(app);
    languageRepositoryService = app.get(LanguageRepositoryService);
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
      'product_category',
      'category',
      'multilingual_text',
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

  // -------------------------------------------------------------------------
  // 헬퍼: GET 목록 조회용 시드 (productCategory, multilingual_text 포함)
  // -------------------------------------------------------------------------
  async function createProductCategory(): Promise<number> {
    const rows = await dataSource.query(
      `INSERT INTO product_category (sort_order) VALUES (1) RETURNING id`,
    );
    return rows[0].id;
  }

  async function ensureCategoryId(): Promise<number> {
    const rows = await dataSource.query(`SELECT id FROM category LIMIT 1`);
    if (rows.length > 0) return rows[0].id;
    const created = await dataSource.query(
      `INSERT INTO category (sort_order) VALUES (1) RETURNING id`,
    );
    return created[0].id;
  }

  async function createBrandWithEnglishName(
    englishName: string | null,
  ): Promise<number> {
    const categoryId = await ensureCategoryId();
    const rows = await dataSource.query(
      `INSERT INTO brand (category_id, english_name) VALUES ($1, $2) RETURNING id`,
      [categoryId, englishName],
    );
    return rows[0].id;
  }

  async function createProductInBrand(
    brandId: number,
    productCategoryId?: number,
  ): Promise<number> {
    const categoryId = await ensureCategoryId();
    const rows = await dataSource.query(
      `INSERT INTO product (brand_id, category_id, product_category_id) VALUES ($1, $2, $3) RETURNING id`,
      [brandId, categoryId, productCategoryId ?? null],
    );
    return rows[0].id;
  }

  async function createProductItemInProduct(
    productId: number,
    options?: { price?: number; discountPrice?: number; createDate?: Date },
  ): Promise<number> {
    const rows = options?.createDate
      ? await dataSource.query(
          `INSERT INTO product_item (product_id, price, discount_price, create_date)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [
            productId,
            options.price ?? 1000,
            options.discountPrice ?? 0,
            options.createDate.toISOString(),
          ],
        )
      : await dataSource.query(
          `INSERT INTO product_item (product_id, price, discount_price)
           VALUES ($1, $2, $3) RETURNING id`,
          [productId, options?.price ?? 1000, options?.discountPrice ?? 0],
        );
    return rows[0].id;
  }

  async function likeProductItem(
    userId: number,
    productItemId: number,
  ): Promise<void> {
    await dataSource.query(
      `INSERT INTO user_product_like (user_id, product_item_id) VALUES ($1, $2)`,
      [userId, productItemId],
    );
  }

  async function likeBrand(userId: number, brandId: number): Promise<void> {
    await dataSource.query(
      `INSERT INTO user_brand_like (user_id, brand_id) VALUES ($1, $2)`,
      [userId, brandId],
    );
  }

  async function saveText(
    entityType: EntityType,
    entityId: number,
    fieldName: string,
    ko: string,
    en?: string,
  ): Promise<void> {
    await languageRepositoryService.saveMultilingualTextByLanguageCode(
      entityType,
      entityId,
      fieldName,
      LanguageCode.KOREAN,
      ko,
    );
    if (en) {
      await languageRepositoryService.saveMultilingualTextByLanguageCode(
        entityType,
        entityId,
        fieldName,
        LanguageCode.ENGLISH,
        en,
      );
    }
  }

  // -------------------------------------------------------------------------
  // GET /user/like/product
  // -------------------------------------------------------------------------
  describe('GET /user/like/product', () => {
    it('좋아요한 상품 목록을 다국어 brandName/productName과 함께 200으로 반환한다', async () => {
      // Given - 유저, 브랜드, 상품, 좋아요, 다국어 텍스트 시드
      const { userId, oneTimeToken } = await signUpAndLogin();
      const brandId = await createBrandWithEnglishName('51percent');
      const productId = await createProductInBrand(brandId);
      const productItemId = await createProductItemInProduct(productId, {
        price: 12000,
        discountPrice: 9000,
      });
      await likeProductItem(userId, productItemId);
      await saveText(EntityType.BRAND, brandId, 'name', '오일일퍼센트');
      await saveText(EntityType.PRODUCT, productId, 'name', '베이직 티셔츠');

      // When
      const res = await request(app.getHttpServer())
        .get(`${LIKE_BASE}/product`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.list).toHaveLength(1);
      const item = res.body.data.list[0];
      expect(item.productItemId).toBe(productItemId);
      expect(item.brandName).toBe('오일일퍼센트');
      expect(item.productName).toBe('베이직 티셔츠');
      expect(item.price).toBe(12000);
      expect(item.discountPrice).toBe(9000);
    });

    it('좋아요한 상품이 없으면 빈 list와 total=0을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .get(`${LIKE_BASE}/product`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.list).toEqual([]);
    });

    it('productCategoryId 쿼리로 필터링하면 해당 카테고리 상품만 반환한다', async () => {
      // Given - 두 개의 productCategory에 속한 상품 좋아요
      const { userId, oneTimeToken } = await signUpAndLogin();
      const brandId = await createBrandWithEnglishName('brand');
      const targetCategoryId = await createProductCategory();
      const otherCategoryId = await createProductCategory();

      const targetProductId = await createProductInBrand(
        brandId,
        targetCategoryId,
      );
      const otherProductId = await createProductInBrand(
        brandId,
        otherCategoryId,
      );
      const targetItemId = await createProductItemInProduct(targetProductId);
      const otherItemId = await createProductItemInProduct(otherProductId);
      await likeProductItem(userId, targetItemId);
      await likeProductItem(userId, otherItemId);
      await saveText(EntityType.BRAND, brandId, 'name', '브랜드');
      await saveText(EntityType.PRODUCT, targetProductId, 'name', '타깃');
      await saveText(EntityType.PRODUCT, otherProductId, 'name', '아더');

      // When
      const res = await request(app.getHttpServer())
        .get(`${LIKE_BASE}/product`)
        .query({ productCategoryId: targetCategoryId })
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.list[0].productItemId).toBe(targetItemId);
    });

    it('페이지네이션이 정상 동작한다 (page=2, count=1)', async () => {
      // Given - 좋아요 2개 등록
      const { userId, oneTimeToken } = await signUpAndLogin();
      const brandId = await createBrandWithEnglishName('brand');
      const productAId = await createProductInBrand(brandId);
      const productBId = await createProductInBrand(brandId);
      const itemAId = await createProductItemInProduct(productAId);
      const itemBId = await createProductItemInProduct(productBId);
      await likeProductItem(userId, itemAId);
      await likeProductItem(userId, itemBId);
      await saveText(EntityType.BRAND, brandId, 'name', '브랜드');
      await saveText(EntityType.PRODUCT, productAId, 'name', 'A');
      await saveText(EntityType.PRODUCT, productBId, 'name', 'B');

      // When - 두 번째 페이지 1개
      const res = await request(app.getHttpServer())
        .get(`${LIKE_BASE}/product`)
        .query({ page: 2, count: 1 })
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.list).toHaveLength(1);
    });

    it('다른 유저의 좋아요는 응답에 포함되지 않는다', async () => {
      // Given - 다른 유저가 상품을 좋아요한 상태에서 본인은 0개
      const other = await signUpAndLogin();
      const me = await signUpAndLogin();
      const brandId = await createBrandWithEnglishName('brand');
      const productId = await createProductInBrand(brandId);
      const itemId = await createProductItemInProduct(productId);
      await likeProductItem(other.userId, itemId);
      await saveText(EntityType.BRAND, brandId, 'name', '브랜드');
      await saveText(EntityType.PRODUCT, productId, 'name', '상품');

      // When
      const res = await request(app.getHttpServer())
        .get(`${LIKE_BASE}/product`)
        .set('Authorization', `Bearer ${me.oneTimeToken}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(0);
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .get(`${LIKE_BASE}/product`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // GET /user/like/brand
  // -------------------------------------------------------------------------
  describe('GET /user/like/brand', () => {
    it('좋아요한 브랜드 목록을 다국어 brandName/totalLikeCount와 함께 200으로 반환한다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const brandId = await createBrandWithEnglishName('51percent');
      await likeBrand(userId, brandId);
      await saveText(EntityType.BRAND, brandId, 'name', '오일일퍼센트');

      // When
      const res = await request(app.getHttpServer())
        .get(`${LIKE_BASE}/brand`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      const brand = res.body.data.list[0];
      expect(brand.brandId).toBe(brandId);
      expect(brand.brandName).toBe('오일일퍼센트');
      expect(brand.englishBrandName).toBe('51percent');
      expect(brand.totalLikeCount).toBe(1);
      expect(brand.recentProductList).toEqual([]);
    });

    it('recentProductList는 createDate DESC로 최근 4개까지만 반환한다', async () => {
      // Given - productItem 5개를 createDate 차이를 두어 생성
      const { userId, oneTimeToken } = await signUpAndLogin();
      const brandId = await createBrandWithEnglishName('brand');
      const productId = await createProductInBrand(brandId);

      const baseTime = Date.now();
      const itemIds: number[] = [];
      for (let i = 0; i < 5; i++) {
        // i가 클수록 최신 (가장 큰 i가 가장 최근)
        const id = await createProductItemInProduct(productId, {
          createDate: new Date(baseTime + i * 1000),
        });
        itemIds.push(id);
      }
      await likeBrand(userId, brandId);
      await saveText(EntityType.BRAND, brandId, 'name', '브랜드');
      await saveText(EntityType.PRODUCT, productId, 'name', '상품');

      // When
      const res = await request(app.getHttpServer())
        .get(`${LIKE_BASE}/brand`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(200);
      const recent = res.body.data.list[0].recentProductList;
      expect(recent).toHaveLength(4);
      // 최신 4개가 createDate DESC 순으로 (마지막에 만든 것부터)
      expect(
        recent.map((p: { productItemId: number }) => p.productItemId),
      ).toEqual([itemIds[4], itemIds[3], itemIds[2], itemIds[1]]);
    });

    it('totalLikeCount는 다른 유저들의 좋아요까지 합산해 반환한다', async () => {
      // Given - 본인 + 다른 유저 2명이 같은 브랜드를 좋아요
      const me = await signUpAndLogin();
      const other1 = await signUpAndLogin();
      const other2 = await signUpAndLogin();
      const brandId = await createBrandWithEnglishName('brand');
      await likeBrand(me.userId, brandId);
      await likeBrand(other1.userId, brandId);
      await likeBrand(other2.userId, brandId);
      await saveText(EntityType.BRAND, brandId, 'name', '브랜드');

      // When
      const res = await request(app.getHttpServer())
        .get(`${LIKE_BASE}/brand`)
        .set('Authorization', `Bearer ${me.oneTimeToken}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.list[0].totalLikeCount).toBe(3);
    });

    it('englishBrandName이 null이면 다국어 brandName으로 fallback한다', async () => {
      // Given - english_name 미입력 브랜드
      const { userId, oneTimeToken } = await signUpAndLogin();
      const brandId = await createBrandWithEnglishName(null);
      await likeBrand(userId, brandId);
      await saveText(EntityType.BRAND, brandId, 'name', '한글브랜드');

      // When
      const res = await request(app.getHttpServer())
        .get(`${LIKE_BASE}/brand`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(200);
      const brand = res.body.data.list[0];
      expect(brand.englishBrandName).toBe('한글브랜드');
      expect(brand.brandName).toBe('한글브랜드');
    });

    it('좋아요한 브랜드가 없으면 빈 list와 total=0을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .get(`${LIKE_BASE}/brand`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.list).toEqual([]);
    });

    it('페이지네이션이 정상 동작한다 (page=2, count=1)', async () => {
      // Given - 브랜드 2개 좋아요
      const { userId, oneTimeToken } = await signUpAndLogin();
      const brandAId = await createBrandWithEnglishName('A');
      const brandBId = await createBrandWithEnglishName('B');
      await likeBrand(userId, brandAId);
      await likeBrand(userId, brandBId);
      await saveText(EntityType.BRAND, brandAId, 'name', 'A');
      await saveText(EntityType.BRAND, brandBId, 'name', 'B');

      // When
      const res = await request(app.getHttpServer())
        .get(`${LIKE_BASE}/brand`)
        .query({ page: 2, count: 1 })
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.list).toHaveLength(1);
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .get(`${LIKE_BASE}/brand`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(401);
    });
  });
});

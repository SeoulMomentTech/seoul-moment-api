import { CacheService } from '@app/cache/cache.service';
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
const RECENT_BASE = '/user/recent';
const REDIS_RECENT_KEY = 'user_recent';

describe('UserRecentController (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let cacheService: CacheService;
  let languageRepositoryService: LanguageRepositoryService;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득 (최초 1회만 부트스트랩)
    app = await getTestApp();
    dataSource = getDataSource(app);
    cacheService = app.get(CacheService);
    languageRepositoryService = app.get(LanguageRepositoryService);
  }, 60_000);

  afterEach(async () => {
    await cacheService.deleteAll();
    await truncateTables(dataSource, [
      'user_recent',
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
  // 헬퍼: signup + login → oneTimeToken 획득
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
  async function ensureCategoryId(): Promise<number> {
    const rows = await dataSource.query(`SELECT id FROM category LIMIT 1`);
    if (rows.length > 0) return rows[0].id;
    const created = await dataSource.query(
      `INSERT INTO category (sort_order) VALUES (1) RETURNING id`,
    );
    return created[0].id;
  }

  async function createProductCategory(): Promise<number> {
    const rows = await dataSource.query(
      `INSERT INTO product_category (sort_order) VALUES (1) RETURNING id`,
    );
    return rows[0].id;
  }

  async function createBrand(): Promise<number> {
    const categoryId = await ensureCategoryId();
    const rows = await dataSource.query(
      `INSERT INTO brand (category_id, english_name) VALUES ($1, $2) RETURNING id`,
      [categoryId, faker.company.name()],
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
    options?: { price?: number; createDate?: Date },
  ): Promise<number> {
    const rows = options?.createDate
      ? await dataSource.query(
          `INSERT INTO product_item (product_id, price, create_date)
           VALUES ($1, $2, $3) RETURNING id`,
          [productId, options.price ?? 1000, options.createDate.toISOString()],
        )
      : await dataSource.query(
          `INSERT INTO product_item (product_id, price)
           VALUES ($1, $2) RETURNING id`,
          [productId, options?.price ?? 1000],
        );
    return rows[0].id;
  }

  async function createProductItemInCategory(
    productCategoryId: number,
    options?: { createDate?: Date },
  ): Promise<{ brandId: number; productId: number; productItemId: number }> {
    const brandId = await createBrand();
    const productId = await createProductInBrand(brandId, productCategoryId);
    const productItemId = await createProductItemInProduct(productId, options);
    return { brandId, productId, productItemId };
  }

  async function saveText(
    entityType: EntityType,
    entityId: number,
    fieldName: string,
    ko: string,
  ): Promise<void> {
    await languageRepositoryService.saveMultilingualTextByLanguageCode(
      entityType,
      entityId,
      fieldName,
      LanguageCode.KOREAN,
      ko,
    );
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

  // -------------------------------------------------------------------------
  // POST /user/recent
  // -------------------------------------------------------------------------
  describe('POST /user/recent', () => {
    it('정상 호출 시 204를 반환하고 Redis 리스트에 productItemId가 추가된다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const productCategoryId = await createProductCategory();
      const { productItemId } =
        await createProductItemInCategory(productCategoryId);

      // When
      const res = await request(app.getHttpServer())
        .post(RECENT_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ productItemId });

      // Then
      expect(res.status).toBe(204);
      const list = await cacheService.getList(`${REDIS_RECENT_KEY}:${userId}`);
      expect(list).toEqual([String(productItemId)]);
    });

    it('동일 productItemId를 두 번 호출해도 캐시에는 한 번만 저장된다 (dedup)', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const productCategoryId = await createProductCategory();
      const { productItemId } =
        await createProductItemInCategory(productCategoryId);

      // When - 같은 상품을 2회 push
      await request(app.getHttpServer())
        .post(RECENT_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ productItemId });
      await request(app.getHttpServer())
        .post(RECENT_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ productItemId });

      // Then - 리스트 길이는 1
      const list = await cacheService.getList(`${REDIS_RECENT_KEY}:${userId}`);
      expect(list).toEqual([String(productItemId)]);
    });

    it('이미 본 상품을 다시 보면 head로 이동한다', async () => {
      // Given - A → B 순으로 view (B가 head)
      const { userId, oneTimeToken } = await signUpAndLogin();
      const productCategoryId = await createProductCategory();
      const { productItemId: itemA } =
        await createProductItemInCategory(productCategoryId);
      const { productItemId: itemB } =
        await createProductItemInCategory(productCategoryId);
      await request(app.getHttpServer())
        .post(RECENT_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ productItemId: itemA });
      await request(app.getHttpServer())
        .post(RECENT_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ productItemId: itemB });

      // When - A를 다시 view
      await request(app.getHttpServer())
        .post(RECENT_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ productItemId: itemA });

      // Then - 캐시 상태: [A, B] (A가 head)
      const list = await cacheService.getList(`${REDIS_RECENT_KEY}:${userId}`);
      expect(list).toEqual([String(itemA), String(itemB)]);
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(RECENT_BASE)
        .send({ productItemId: 1 });

      // Then
      expect(res.status).toBe(401);
    });

    it('productItemId가 누락되면 400을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .post(RECENT_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({});

      // Then
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // GET /user/recent
  // -------------------------------------------------------------------------
  describe('GET /user/recent', () => {
    it('캐시·DB 모두 비어있어도 200과 빈 list를 반환한다', async () => {
      // Given - 갓 가입한 유저, 아무 데이터 없음
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .get(RECENT_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.list).toEqual([]);
    });

    it('캐시에만 있던 항목이 DB로 sync되어 응답에 포함되고, 응답 후 캐시는 비워진다', async () => {
      // Given - cache에 productItemId 1개를 push
      const { userId, oneTimeToken } = await signUpAndLogin();
      const productCategoryId = await createProductCategory();
      const { brandId, productId, productItemId } =
        await createProductItemInCategory(productCategoryId);
      await saveText(EntityType.BRAND, brandId, 'name', '브랜드');
      await saveText(EntityType.PRODUCT, productId, 'name', '상품');
      await request(app.getHttpServer())
        .post(RECENT_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ productItemId });

      // When
      const res = await request(app.getHttpServer())
        .get(RECENT_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then - 응답 검증
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.list[0].productItemId).toBe(productItemId);

      // Then - DB sync 확인
      const dbRows = await dataSource.query(
        `SELECT user_id, product_item_id FROM user_recent
         WHERE user_id = $1 AND product_item_id = $2`,
        [userId, productItemId],
      );
      expect(dbRows).toHaveLength(1);

      // Then - 캐시 비워짐 확인
      const list = await cacheService.getList(`${REDIS_RECENT_KEY}:${userId}`);
      expect(list).toEqual([]);
    });

    it('like 필드는 user_product_like 집계 결과를 반환한다 (userProductLikes 미로딩 회피)', async () => {
      // Given - productItem 하나에 다른 유저 2명이 좋아요
      const { userId, oneTimeToken } = await signUpAndLogin();
      const other1 = await signUpAndLogin();
      const other2 = await signUpAndLogin();
      const productCategoryId = await createProductCategory();
      const { brandId, productId, productItemId } =
        await createProductItemInCategory(productCategoryId);
      await saveText(EntityType.BRAND, brandId, 'name', '브랜드');
      await saveText(EntityType.PRODUCT, productId, 'name', '상품');
      await likeProductItem(other1.userId, productItemId);
      await likeProductItem(other2.userId, productItemId);

      // user_recent 직접 insert (cache 우회)
      await dataSource.query(
        `INSERT INTO user_recent (user_id, product_item_id) VALUES ($1, $2)`,
        [userId, productItemId],
      );

      // When
      const res = await request(app.getHttpServer())
        .get(RECENT_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.list[0].like).toBe(2);
    });

    it('updateDate 기준 정렬: 다시 본 상품이 상단에 위치한다', async () => {
      // Given - A를 보고, B를 보고, A를 다시 봄
      const { userId, oneTimeToken } = await signUpAndLogin();
      const productCategoryId = await createProductCategory();
      const seedA = await createProductItemInCategory(productCategoryId);
      const seedB = await createProductItemInCategory(productCategoryId);
      await saveText(EntityType.BRAND, seedA.brandId, 'name', '브랜드A');
      await saveText(EntityType.PRODUCT, seedA.productId, 'name', '상품A');
      await saveText(EntityType.BRAND, seedB.brandId, 'name', '브랜드B');
      await saveText(EntityType.PRODUCT, seedB.productId, 'name', '상품B');

      // 첫 번째 sync: A, B를 DB에 저장
      await request(app.getHttpServer())
        .post(RECENT_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ productItemId: seedA.productItemId });
      await request(app.getHttpServer())
        .post(RECENT_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ productItemId: seedB.productItemId });
      await request(app.getHttpServer())
        .get(RECENT_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // updateDate 차이를 확보하기 위해 잠시 대기
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 두 번째 sync: A 다시 본 상태로 upsert → updateDate 갱신
      await request(app.getHttpServer())
        .post(RECENT_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ productItemId: seedA.productItemId });

      // When
      const res = await request(app.getHttpServer())
        .get(RECENT_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then - A가 첫 번째 (가장 최근에 봤으므로 updateDate가 더 큼)
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.list[0].productItemId).toBe(seedA.productItemId);
      expect(res.body.data.list[1].productItemId).toBe(seedB.productItemId);

      // Then - DB에 row 수도 2개 (중복 row 없음, upsert 동작)
      const rows = await dataSource.query(
        `SELECT product_item_id FROM user_recent WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(2);
    });

    it('다른 유저의 최근 본 상품은 응답에 포함되지 않는다', async () => {
      // Given
      const me = await signUpAndLogin();
      const other = await signUpAndLogin();
      const productCategoryId = await createProductCategory();
      const { brandId, productId, productItemId } =
        await createProductItemInCategory(productCategoryId);
      await saveText(EntityType.BRAND, brandId, 'name', '브랜드');
      await saveText(EntityType.PRODUCT, productId, 'name', '상품');
      await dataSource.query(
        `INSERT INTO user_recent (user_id, product_item_id) VALUES ($1, $2)`,
        [other.userId, productItemId],
      );

      // When
      const res = await request(app.getHttpServer())
        .get(RECENT_BASE)
        .set('Authorization', `Bearer ${me.oneTimeToken}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(0);
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .get(RECENT_BASE)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // GET /user/recent/recommend
  // -------------------------------------------------------------------------
  describe('GET /user/recent/recommend', () => {
    it('최근 본 상품이 없으면 빈 list와 total=0을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .get(`${RECENT_BASE}/recommend`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.list).toEqual([]);
    });

    it('top category 동일 카테고리의 다른 상품을 추천하고 이미 본 상품은 제외한다', async () => {
      // Given - 동일 productCategory에 4개 상품, 그 중 1개를 user가 본 상태
      const { oneTimeToken } = await signUpAndLogin();
      const productCategoryId = await createProductCategory();

      const viewed = await createProductItemInCategory(productCategoryId);
      const candidate1 = await createProductItemInCategory(productCategoryId);
      const candidate2 = await createProductItemInCategory(productCategoryId);
      const candidate3 = await createProductItemInCategory(productCategoryId);

      for (const seed of [viewed, candidate1, candidate2, candidate3]) {
        await saveText(EntityType.BRAND, seed.brandId, 'name', '브랜드');
        await saveText(EntityType.PRODUCT, seed.productId, 'name', '상품');
      }

      await request(app.getHttpServer())
        .post(RECENT_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ productItemId: viewed.productItemId });

      // When
      const res = await request(app.getHttpServer())
        .get(`${RECENT_BASE}/recommend`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then - viewed는 빠지고 candidate들만 포함
      expect(res.status).toBe(200);
      const ids: number[] = res.body.data.list.map(
        (v: { productItemId: number }) => v.productItemId,
      );
      expect(ids).not.toContain(viewed.productItemId);
      expect(ids).toEqual(
        expect.arrayContaining([
          candidate1.productItemId,
          candidate2.productItemId,
          candidate3.productItemId,
        ]),
      );
    });

    it('추천 결과는 최대 4개까지 반환한다', async () => {
      // Given - 동일 productCategory에 6개 상품, 1개만 봄 → 후보 5개
      const { oneTimeToken } = await signUpAndLogin();
      const productCategoryId = await createProductCategory();

      const viewed = await createProductItemInCategory(productCategoryId);
      const candidates: number[] = [];
      for (let i = 0; i < 5; i++) {
        const seed = await createProductItemInCategory(productCategoryId);
        candidates.push(seed.productItemId);
        await saveText(EntityType.BRAND, seed.brandId, 'name', '브랜드');
        await saveText(EntityType.PRODUCT, seed.productId, 'name', '상품');
      }
      await saveText(EntityType.BRAND, viewed.brandId, 'name', '브랜드');
      await saveText(EntityType.PRODUCT, viewed.productId, 'name', '상품');

      await request(app.getHttpServer())
        .post(RECENT_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ productItemId: viewed.productItemId });

      // When
      const res = await request(app.getHttpServer())
        .get(`${RECENT_BASE}/recommend`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then - 5개 후보 중 최대 4개만
      expect(res.status).toBe(200);
      expect(res.body.data.list).toHaveLength(4);
    });

    it('cache에만 있던 최근 본 상품도 top category 집계에 반영된다 (sync 검증)', async () => {
      // Given - 두 카테고리: target에 본 상품 1개(cache), other에는 본 상품 0개
      // cache에만 있는 productItem이 sync되어 top category가 결정되어야 함
      const { oneTimeToken } = await signUpAndLogin();
      const targetCategoryId = await createProductCategory();
      const otherCategoryId = await createProductCategory();

      const viewedInTarget =
        await createProductItemInCategory(targetCategoryId);
      const candidateInTarget =
        await createProductItemInCategory(targetCategoryId);
      const candidateInOther =
        await createProductItemInCategory(otherCategoryId);

      for (const seed of [
        viewedInTarget,
        candidateInTarget,
        candidateInOther,
      ]) {
        await saveText(EntityType.BRAND, seed.brandId, 'name', '브랜드');
        await saveText(EntityType.PRODUCT, seed.productId, 'name', '상품');
      }

      // 본 상품을 cache에만 push (DB sync는 추천 호출 시 일어남)
      await request(app.getHttpServer())
        .post(RECENT_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ productItemId: viewedInTarget.productItemId });

      // When - GET /user/recent를 거치지 않고 바로 recommend 호출
      const res = await request(app.getHttpServer())
        .get(`${RECENT_BASE}/recommend`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then - target 카테고리의 candidate만 포함, other 카테고리 candidate은 제외
      expect(res.status).toBe(200);
      const ids: number[] = res.body.data.list.map(
        (v: { productItemId: number }) => v.productItemId,
      );
      expect(ids).toContain(candidateInTarget.productItemId);
      expect(ids).not.toContain(candidateInOther.productItemId);
      expect(ids).not.toContain(viewedInTarget.productItemId);
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .get(`${RECENT_BASE}/recommend`)
        .set('Accept-language', LanguageCode.KOREAN);

      // Then
      expect(res.status).toBe(401);
    });
  });
});

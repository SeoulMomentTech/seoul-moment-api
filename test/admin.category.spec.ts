import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { authHeader, getAdminToken } from './setup/auth.helper';
import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

const V1_BASE_URL = '/admin/category/v1';

describe('AdminCategoryController (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득
    app = await getTestApp();
    dataSource = getDataSource(app);
    await getAdminToken(app);

    // Given - 언어 시드 데이터 준비
    await ensureLanguageSeed();
  }, 60_000);

  async function ensureLanguageSeed() {
    const languages = await dataSource.query(`SELECT id FROM language LIMIT 1`);
    if (languages.length === 0) {
      await dataSource.query(
        `INSERT INTO language (code, name, english_name, is_active, sort_order)
         VALUES ('ko', '한국어', 'Korean', true, 1),
                ('en', '영어', 'English', true, 2),
                ('zh', '중국어', 'Chinese', true, 3)`,
      );
    }
  }

  afterEach(async () => {
    await truncateTables(dataSource, ['multilingual_text', 'category']);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // Helper: SQL로 카테고리 + 다국어 텍스트 직접 생성
  async function createCategoryWithLanguages(
    names: { ko: string; en: string } = {
      ko: faker.commerce.department(),
      en: faker.commerce.department(),
    },
  ): Promise<number> {
    const result = await dataSource.query(
      `INSERT INTO category (sort_order) VALUES (1) RETURNING id`,
    );
    const categoryId = result[0].id;

    const languages = await dataSource.query(
      `SELECT id, code FROM language WHERE is_active = true`,
    );

    for (const lang of languages) {
      const name =
        lang.code === 'ko'
          ? names.ko
          : lang.code === 'en'
            ? names.en
            : names.ko;
      await dataSource.query(
        `INSERT INTO multilingual_text
           (entity_type, entity_id, field_name, language_id, text_content)
         VALUES ('category', $1, 'name', $2, $3)`,
        [categoryId, lang.id, name],
      );
    }

    return categoryId;
  }

  // -----------------------------------------------------------------------
  // GET /admin/category/v1
  // -----------------------------------------------------------------------
  describe('GET /admin/category/v1', () => {
    it('카테고리가 없을 때 빈 배열을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .get(V1_BASE_URL)
        .set('Authorization', await authHeader(app));

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.list).toEqual([]);
    });

    it('카테고리 목록을 languageList 포함하여 반환한다', async () => {
      // Given
      await createCategoryWithLanguages({
        ko: '테스트카테고리',
        en: 'TestCategory',
      });

      // When
      const res = await request(app.getHttpServer())
        .get(V1_BASE_URL)
        .set('Authorization', await authHeader(app));

      // Then
      expect(res.status).toBe(200);
      const list = res.body.data.list;
      expect(list.length).toBeGreaterThanOrEqual(1);

      const category = list[0];
      expect(category).toHaveProperty('id');
      expect(category).toHaveProperty('languageList');
      expect(category).toHaveProperty('createDate');
      expect(category).toHaveProperty('updateDate');
      expect(Array.isArray(category.languageList)).toBe(true);
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).get(V1_BASE_URL);

      // Then
      expect(res.status).toBe(401);
    });
  });

  // -----------------------------------------------------------------------
  // PATCH /admin/category/v1/:id
  // -----------------------------------------------------------------------
  describe('PATCH /admin/category/v1/:id', () => {
    it('카테고리를 수정하면 204를 반환한다', async () => {
      // Given
      const categoryId = await createCategoryWithLanguages();

      const updateBody = {
        languageList: [
          { languageCode: 'ko', name: faker.commerce.department() },
          { languageCode: 'en', name: faker.commerce.department() },
        ],
        sortOrder: 99,
      };

      // When
      const res = await request(app.getHttpServer())
        .patch(`${V1_BASE_URL}/${categoryId}`)
        .set('Authorization', await authHeader(app))
        .send(updateBody);

      // Then
      expect(res.status).toBe(204);
    });

    it('수정 후 목록 조회 시 변경된 데이터가 반영된다', async () => {
      // Given
      const categoryId = await createCategoryWithLanguages({
        ko: '반영확인',
        en: 'OriginalEnglish',
      });
      const auth = await authHeader(app);

      const newKoName = faker.commerce.department();
      const updateBody = {
        languageList: [
          { languageCode: 'ko', name: newKoName },
          { languageCode: 'en', name: 'UpdatedEnglish' },
        ],
        sortOrder: 50,
      };

      // When
      await request(app.getHttpServer())
        .patch(`${V1_BASE_URL}/${categoryId}`)
        .set('Authorization', auth)
        .send(updateBody);

      const afterRes = await request(app.getHttpServer())
        .get(V1_BASE_URL)
        .set('Authorization', auth);

      // Then
      const updated = afterRes.body.data.list.find(
        (c: any) => c.id === categoryId,
      );
      expect(updated).toBeDefined();

      const koLang = updated.languageList.find(
        (l: any) => l.languageCode === 'ko',
      );
      expect(koLang.name).toBe(newKoName);

      const enLang = updated.languageList.find(
        (l: any) => l.languageCode === 'en',
      );
      expect(enLang.name).toBe('UpdatedEnglish');
    });

    it('존재하지 않는 카테고리 수정 시 404를 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .patch(`${V1_BASE_URL}/999999`)
        .set('Authorization', await authHeader(app))
        .send({
          languageList: [{ languageCode: 'ko', name: '없는카테고리' }],
          sortOrder: 1,
        });

      // Then
      expect(res.status).toBe(404);
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .patch(`${V1_BASE_URL}/1`)
        .send({
          languageList: [{ languageCode: 'ko', name: '무인증' }],
          sortOrder: 1,
        });

      // Then
      expect(res.status).toBe(401);
    });
  });

  // -----------------------------------------------------------------------
  // GET /admin/category/v1/:id
  // -----------------------------------------------------------------------
  describe('GET /admin/category/v1/:id', () => {
    it('카테고리 정보를 조회하면 200과 함께 카테고리 데이터를 반환한다', async () => {
      // Given
      const categoryId = await createCategoryWithLanguages({
        ko: '테스트카테고리',
        en: 'TestCategory',
      });

      // When
      const res = await request(app.getHttpServer())
        .get(`${V1_BASE_URL}/${categoryId}`)
        .set('Authorization', await authHeader(app));

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(categoryId);
      expect(Array.isArray(res.body.data.languageList)).toBe(true);
      expect(res.body.data.languageList.length).toBeGreaterThan(0);
      expect(res.body.data).toHaveProperty('createDate');
      expect(res.body.data).toHaveProperty('updateDate');
    });

    it('조회된 카테고리의 다국어 정보가 올바르게 반영된다', async () => {
      // Given
      const koName = '뷰티';
      const enName = 'Beauty';
      const categoryId = await createCategoryWithLanguages({
        ko: koName,
        en: enName,
      });

      // When
      const res = await request(app.getHttpServer())
        .get(`${V1_BASE_URL}/${categoryId}`)
        .set('Authorization', await authHeader(app));

      // Then
      expect(res.status).toBe(200);
      const languageList = res.body.data.languageList;

      const koLang = languageList.find((l: any) => l.languageCode === 'ko');
      expect(koLang).toBeDefined();
      expect(koLang.name).toBe(koName);

      const enLang = languageList.find((l: any) => l.languageCode === 'en');
      expect(enLang).toBeDefined();
      expect(enLang.name).toBe(enName);
    });

    it('존재하지 않는 카테고리 조회 시 404를 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .get(`${V1_BASE_URL}/999999`)
        .set('Authorization', await authHeader(app));

      // Then
      expect(res.status).toBe(404);
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).get(`${V1_BASE_URL}/1`);

      // Then
      expect(res.status).toBe(401);
    });
  });
});

import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { authHeader, getAdminToken } from './setup/auth.helper';
import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

const CATEGORY_URL = '/admin/news/category';
const HASHTAG_URL = '/admin/news/hashtag';

const TABLES = ['multilingual_text', 'news_category', 'news_hashtag'];

describe('AdminNewsController - Category/Hashtag CRUD (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득
    app = await getTestApp();
    dataSource = getDataSource(app);
    await getAdminToken(app);

    // Given - 언어 시드 데이터 준비
    await ensureLanguageSeed();

    // Given - 선행 spec이 남긴 데이터 정리
    await truncateTables(dataSource, TABLES);
  }, 60_000);

  afterEach(async () => {
    await truncateTables(dataSource, TABLES);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  async function ensureLanguageSeed() {
    const languages = await dataSource.query(`SELECT id FROM language LIMIT 1`);
    if (languages.length === 0) {
      await dataSource.query(
        `INSERT INTO language (code, name, english_name, is_active, sort_order)
         VALUES ('ko', '한국어', 'Korean', true, 1),
                ('en', '영어', 'English', true, 2),
                ('zh-TW', '中文', 'Taiwan', true, 3)`,
      );
    }
  }

  async function getLanguages(): Promise<{ id: number; code: string }[]> {
    return dataSource.query(
      `SELECT id, code FROM language WHERE is_active = true ORDER BY sort_order ASC`,
    );
  }

  // Helper: 뉴스 카테고리/해시태그 + 다국어 이름을 SQL로 직접 생성
  async function createTaxonomy(
    table: 'news_category' | 'news_hashtag',
    entityType: 'news_category' | 'news_hashtag',
    names: { ko: string; en: string; zh: string },
  ): Promise<number> {
    const result = await dataSource.query(
      `INSERT INTO ${table} DEFAULT VALUES RETURNING id`,
    );
    const id = result[0].id;

    const languages = await getLanguages();
    for (const lang of languages) {
      const name =
        lang.code === 'ko'
          ? names.ko
          : lang.code === 'en'
            ? names.en
            : names.zh;
      await dataSource.query(
        `INSERT INTO multilingual_text
           (entity_type, entity_id, field_name, language_id, text_content)
         VALUES ($1, $2, 'name', $3, $4)`,
        [entityType, id, lang.id, name],
      );
    }

    return id;
  }

  function sampleNames() {
    return {
      ko: faker.commerce.department(),
      en: faker.commerce.department(),
      zh: faker.commerce.department(),
    };
  }

  // =======================================================================
  // News Category
  // =======================================================================
  describe('News Category', () => {
    describe('GET /admin/news/category', () => {
      it('카테고리가 없을 때 빈 배열을 반환한다', async () => {
        // When
        const res = await request(app.getHttpServer())
          .get(CATEGORY_URL)
          .set('Authorization', await authHeader(app));

        // Then
        expect(res.status).toBe(200);
        expect(res.body.data.list).toEqual([]);
        expect(res.body.data.total).toBe(0);
      });

      it('카테고리 목록을 다국어 nameList와 함께 반환한다', async () => {
        // Given
        await createTaxonomy('news_category', 'news_category', {
          ko: '브랜드뉴스',
          en: 'BrandNews',
          zh: '品牌新聞',
        });

        // When
        const res = await request(app.getHttpServer())
          .get(CATEGORY_URL)
          .set('Authorization', await authHeader(app));

        // Then
        expect(res.status).toBe(200);
        const list = res.body.data.list;
        expect(list.length).toBe(1);

        const category = list[0];
        expect(category).toHaveProperty('id');
        expect(Array.isArray(category.nameList)).toBe(true);
        expect(category.nameList.length).toBe(3);

        const koName = category.nameList.find(
          (n: any) => n.languageCode === 'ko',
        );
        expect(koName.name).toBe('브랜드뉴스');
        expect(koName).toHaveProperty('languageId');
      });

      it('토큰 없이 요청하면 401을 반환한다', async () => {
        // When
        const res = await request(app.getHttpServer()).get(CATEGORY_URL);

        // Then
        expect(res.status).toBe(401);
      });
    });

    describe('GET /admin/news/category/:id', () => {
      it('카테고리 정보를 조회하면 200과 다국어 이름을 반환한다', async () => {
        // Given
        const names = { ko: '뷰티', en: 'Beauty', zh: '美妝' };
        const id = await createTaxonomy(
          'news_category',
          'news_category',
          names,
        );

        // When
        const res = await request(app.getHttpServer())
          .get(`${CATEGORY_URL}/${id}`)
          .set('Authorization', await authHeader(app));

        // Then
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(id);

        const nameList = res.body.data.nameList;
        expect(nameList.find((n: any) => n.languageCode === 'ko').name).toBe(
          names.ko,
        );
        expect(nameList.find((n: any) => n.languageCode === 'en').name).toBe(
          names.en,
        );
        expect(nameList.find((n: any) => n.languageCode === 'zh-TW').name).toBe(
          names.zh,
        );
      });

      it('존재하지 않는 카테고리 조회 시 404를 반환한다', async () => {
        // When
        const res = await request(app.getHttpServer())
          .get(`${CATEGORY_URL}/999999`)
          .set('Authorization', await authHeader(app));

        // Then
        expect(res.status).toBe(404);
      });
    });

    describe('PATCH /admin/news/category/:id', () => {
      it('카테고리 다국어 이름을 수정하면 202를 반환하고 조회 시 반영된다', async () => {
        // Given
        const id = await createTaxonomy('news_category', 'news_category', {
          ko: '원본',
          en: 'Origin',
          zh: '原本',
        });
        const auth = await authHeader(app);
        const languages = await getLanguages();
        const koId = languages.find((l) => l.code === 'ko').id;
        const newKoName = faker.commerce.department();

        // When
        const patchRes = await request(app.getHttpServer())
          .patch(`${CATEGORY_URL}/${id}`)
          .set('Authorization', auth)
          .send({ nameList: [{ languageId: koId, name: newKoName }] });

        // Then
        expect(patchRes.status).toBe(202);

        const getRes = await request(app.getHttpServer())
          .get(`${CATEGORY_URL}/${id}`)
          .set('Authorization', auth);
        const koName = getRes.body.data.nameList.find(
          (n: any) => n.languageCode === 'ko',
        );
        expect(koName.name).toBe(newKoName);
      });

      it('존재하지 않는 카테고리 수정 시 404를 반환한다', async () => {
        // Given
        const languages = await getLanguages();
        const koId = languages.find((l) => l.code === 'ko').id;

        // When
        const res = await request(app.getHttpServer())
          .patch(`${CATEGORY_URL}/999999`)
          .set('Authorization', await authHeader(app))
          .send({ nameList: [{ languageId: koId, name: '없음' }] });

        // Then
        expect(res.status).toBe(404);
      });
    });

    describe('DELETE /admin/news/category/:id', () => {
      it('카테고리를 삭제하면 202를 반환하고 다국어 텍스트도 제거된다', async () => {
        // Given
        const id = await createTaxonomy(
          'news_category',
          'news_category',
          sampleNames(),
        );
        const auth = await authHeader(app);

        // When
        const delRes = await request(app.getHttpServer())
          .delete(`${CATEGORY_URL}/${id}`)
          .set('Authorization', auth);

        // Then
        expect(delRes.status).toBe(202);

        const getRes = await request(app.getHttpServer())
          .get(`${CATEGORY_URL}/${id}`)
          .set('Authorization', auth);
        expect(getRes.status).toBe(404);

        const remain = await dataSource.query(
          `SELECT COUNT(*)::int AS cnt FROM multilingual_text
           WHERE entity_type = 'news_category' AND entity_id = $1`,
          [id],
        );
        expect(remain[0].cnt).toBe(0);
      });

      it('존재하지 않는 카테고리 삭제 시 404를 반환한다', async () => {
        // When
        const res = await request(app.getHttpServer())
          .delete(`${CATEGORY_URL}/999999`)
          .set('Authorization', await authHeader(app));

        // Then
        expect(res.status).toBe(404);
      });
    });
  });

  // =======================================================================
  // News Hashtag
  // =======================================================================
  describe('News Hashtag', () => {
    describe('GET /admin/news/hashtag', () => {
      it('해시태그가 없을 때 빈 배열을 반환한다', async () => {
        // When
        const res = await request(app.getHttpServer())
          .get(HASHTAG_URL)
          .set('Authorization', await authHeader(app));

        // Then
        expect(res.status).toBe(200);
        expect(res.body.data.list).toEqual([]);
      });

      it('해시태그 목록을 다국어 nameList와 함께 반환한다', async () => {
        // Given
        await createTaxonomy('news_hashtag', 'news_hashtag', {
          ko: '서울',
          en: 'Seoul',
          zh: '首爾',
        });

        // When
        const res = await request(app.getHttpServer())
          .get(HASHTAG_URL)
          .set('Authorization', await authHeader(app));

        // Then
        expect(res.status).toBe(200);
        const list = res.body.data.list;
        expect(list.length).toBe(1);
        expect(list[0].nameList.length).toBe(3);
        expect(
          list[0].nameList.find((n: any) => n.languageCode === 'ko').name,
        ).toBe('서울');
      });

      it('토큰 없이 요청하면 401을 반환한다', async () => {
        // When
        const res = await request(app.getHttpServer()).get(HASHTAG_URL);

        // Then
        expect(res.status).toBe(401);
      });
    });

    describe('GET /admin/news/hashtag/:id', () => {
      it('해시태그 정보를 조회하면 200과 다국어 이름을 반환한다', async () => {
        // Given
        const names = { ko: '핫플', en: 'HotPlace', zh: '熱門地點' };
        const id = await createTaxonomy('news_hashtag', 'news_hashtag', names);

        // When
        const res = await request(app.getHttpServer())
          .get(`${HASHTAG_URL}/${id}`)
          .set('Authorization', await authHeader(app));

        // Then
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(id);
        expect(
          res.body.data.nameList.find((n: any) => n.languageCode === 'en').name,
        ).toBe(names.en);
      });

      it('존재하지 않는 해시태그 조회 시 404를 반환한다', async () => {
        // When
        const res = await request(app.getHttpServer())
          .get(`${HASHTAG_URL}/999999`)
          .set('Authorization', await authHeader(app));

        // Then
        expect(res.status).toBe(404);
      });
    });

    describe('PATCH /admin/news/hashtag/:id', () => {
      it('해시태그 다국어 이름을 수정하면 202를 반환하고 조회 시 반영된다', async () => {
        // Given
        const id = await createTaxonomy('news_hashtag', 'news_hashtag', {
          ko: '원본',
          en: 'Origin',
          zh: '原本',
        });
        const auth = await authHeader(app);
        const languages = await getLanguages();
        const enId = languages.find((l) => l.code === 'en').id;
        const newEnName = faker.location.city();

        // When
        const patchRes = await request(app.getHttpServer())
          .patch(`${HASHTAG_URL}/${id}`)
          .set('Authorization', auth)
          .send({ nameList: [{ languageId: enId, name: newEnName }] });

        // Then
        expect(patchRes.status).toBe(202);

        const getRes = await request(app.getHttpServer())
          .get(`${HASHTAG_URL}/${id}`)
          .set('Authorization', auth);
        expect(
          getRes.body.data.nameList.find((n: any) => n.languageCode === 'en')
            .name,
        ).toBe(newEnName);
      });

      it('존재하지 않는 해시태그 수정 시 404를 반환한다', async () => {
        // Given
        const languages = await getLanguages();
        const koId = languages.find((l) => l.code === 'ko').id;

        // When
        const res = await request(app.getHttpServer())
          .patch(`${HASHTAG_URL}/999999`)
          .set('Authorization', await authHeader(app))
          .send({ nameList: [{ languageId: koId, name: '없음' }] });

        // Then
        expect(res.status).toBe(404);
      });
    });

    describe('DELETE /admin/news/hashtag/:id', () => {
      it('해시태그를 삭제하면 202를 반환하고 다국어 텍스트도 제거된다', async () => {
        // Given
        const id = await createTaxonomy(
          'news_hashtag',
          'news_hashtag',
          sampleNames(),
        );
        const auth = await authHeader(app);

        // When
        const delRes = await request(app.getHttpServer())
          .delete(`${HASHTAG_URL}/${id}`)
          .set('Authorization', auth);

        // Then
        expect(delRes.status).toBe(202);

        const remain = await dataSource.query(
          `SELECT COUNT(*)::int AS cnt FROM multilingual_text
           WHERE entity_type = 'news_hashtag' AND entity_id = $1`,
          [id],
        );
        expect(remain[0].cnt).toBe(0);
      });

      it('존재하지 않는 해시태그 삭제 시 404를 반환한다', async () => {
        // When
        const res = await request(app.getHttpServer())
          .delete(`${HASHTAG_URL}/999999`)
          .set('Authorization', await authHeader(app));

        // Then
        expect(res.status).toBe(404);
      });
    });
  });
});

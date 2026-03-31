import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { authHeader, getAdminToken } from './setup/auth.helper';
import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

const BASE_URL = '/admin/brand';

describe('AdminBrandController (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let categoryId: number;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득 (최초 1회만 부트스트랩)
    app = await getTestApp();
    dataSource = getDataSource(app);
    await getAdminToken(app);

    // Given - 카테고리와 언어 시드 데이터 준비
    await ensureSeedData();
  }, 60_000);

  async function ensureSeedData() {
    // 카테고리가 있는지 확인, 없으면 생성
    const categories = await dataSource.query(
      `SELECT id FROM category LIMIT 1`,
    );
    if (categories.length > 0) {
      categoryId = categories[0].id;
    } else {
      const result = await dataSource.query(
        `INSERT INTO category (sort_order) VALUES (1) RETURNING id`,
      );
      categoryId = result[0].id;
    }

    // 언어 데이터가 있는지 확인, 없으면 생성
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
    await truncateTables(dataSource, [
      'brand_section_image',
      'brand_section',
      'brand_mobile_banner_image',
      'brand_banner_image',
      'multilingual_text',
      'brand',
    ]);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // -----------------------------------------------------------------------
  // POST /admin/brand
  // -----------------------------------------------------------------------
  describe('POST /admin/brand', () => {
    function buildPostBody(overrides?: Record<string, any>) {
      return {
        textList: [
          {
            languageId: 1,
            name: faker.company.name(),
            description: faker.company.catchPhrase(),
          },
        ],
        categoryId,
        profileImageUrl: faker.image.url(),
        sectionList: [
          {
            textList: [
              {
                languageId: 1,
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
              },
            ],
            imageUrlList: ['/section/img1.jpg'],
          },
        ],
        bannerImageUrlList: ['/banner/img1.jpg'],
        mobileBannerImageUrlList: ['/m/banner/img1.jpg'],
        productBannerImageUrl: '/product/banner.jpg',
        englishName: faker.company.name(),
        ...overrides,
      };
    }

    it('유효한 데이터로 브랜드를 등록하면 204를 반환한다', async () => {
      // Given
      const body = buildPostBody();

      // When
      const res = await request(app.getHttpServer())
        .post(BASE_URL)
        .set('Authorization', await authHeader(app))
        .send(body);

      // Then
      expect(res.status).toBe(204);
    });

    it('등록 후 GET 목록에서 조회할 수 있다', async () => {
      // Given
      const auth = await authHeader(app);
      const englishName = `TestBrand-${Date.now()}`;
      await request(app.getHttpServer())
        .post(BASE_URL)
        .set('Authorization', auth)
        .send(buildPostBody({ englishName }));

      // When
      const res = await request(app.getHttpServer())
        .get(BASE_URL)
        .set('Authorization', auth);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.list.length).toBeGreaterThanOrEqual(1);
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(BASE_URL)
        .send(buildPostBody());

      // Then
      expect(res.status).toBe(401);
    });

    it('필수 필드(textList) 누락 시 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(BASE_URL)
        .set('Authorization', await authHeader(app))
        .send({
          categoryId,
          bannerImageUrlList: ['/banner/img1.jpg'],
          mobileBannerImageUrlList: ['/m/banner/img1.jpg'],
          productBannerImageUrl: '/product/banner.jpg',
          englishName: 'Test',
          sectionList: [],
        });

      // Then
      expect(res.status).toBe(400);
    });

    it('필수 필드(englishName) 누락 시 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(BASE_URL)
        .set('Authorization', await authHeader(app))
        .send({
          textList: [
            {
              languageId: 1,
              name: 'Test',
              description: 'Test desc',
            },
          ],
          categoryId,
          bannerImageUrlList: ['/banner/img1.jpg'],
          mobileBannerImageUrlList: ['/m/banner/img1.jpg'],
          productBannerImageUrl: '/product/banner.jpg',
          sectionList: [],
        });

      // Then
      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // GET /admin/brand
  // -----------------------------------------------------------------------
  describe('GET /admin/brand', () => {
    it('브랜드가 없을 때 빈 배열을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .get(BASE_URL)
        .set('Authorization', await authHeader(app));

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.list).toEqual([]);
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).get(BASE_URL);

      // Then
      expect(res.status).toBe(401);
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /admin/brand/:id
  // -----------------------------------------------------------------------
  describe('DELETE /admin/brand/:id', () => {
    it('존재하는 브랜드를 삭제하면 202를 반환한다', async () => {
      // Given - 브랜드 생성
      const auth = await authHeader(app);
      await request(app.getHttpServer())
        .post(BASE_URL)
        .set('Authorization', auth)
        .send({
          textList: [
            {
              languageId: 1,
              name: 'DeleteTest',
              description: 'To be deleted',
            },
          ],
          categoryId,
          sectionList: [],
          bannerImageUrlList: ['/banner/del.jpg'],
          mobileBannerImageUrlList: ['/m/del.jpg'],
          productBannerImageUrl: '/product/del.jpg',
          englishName: 'DeleteBrand',
        });

      const listRes = await request(app.getHttpServer())
        .get(BASE_URL)
        .set('Authorization', auth);
      const brandId = listRes.body.data.list[0].id;

      // When
      const res = await request(app.getHttpServer())
        .delete(`${BASE_URL}/${brandId}`)
        .set('Authorization', auth);

      // Then
      expect(res.status).toBe(202);
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).delete(`${BASE_URL}/1`);

      // Then
      expect(res.status).toBe(401);
    });
  });
});

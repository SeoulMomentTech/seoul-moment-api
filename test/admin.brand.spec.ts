import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { authHeader, getAdminToken } from './setup/auth.helper';
import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

const BASE_URL = '/admin/brand';
const V1_BASE_URL = '/admin/brand/v1';

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

  // -----------------------------------------------------------------------
  // POST /admin/brand/v1 (V1 API - 언어코드 기반)
  // -----------------------------------------------------------------------
  describe('POST /admin/brand/v1', () => {
    function buildV1PostBody(overrides?: Record<string, any>) {
      return {
        languageList: [
          {
            languageCode: 'ko',
            name: faker.company.name(),
            description: faker.company.catchPhrase(),
          },
          {
            languageCode: 'en',
            name: faker.company.name(),
            description: faker.company.catchPhrase(),
          },
        ],
        categoryId,
        profileImageUrl: faker.image.url(),
        sectionList: [
          {
            languageList: [
              {
                languageCode: 'ko',
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
              },
              {
                languageCode: 'en',
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
              },
            ],
            imageUrlList: [faker.image.url()],
          },
        ],
        bannerImageUrlList: [faker.image.url()],
        mobileBannerImageUrlList: [faker.image.url()],
        productBannerImageUrl: faker.image.url(),
        englishName: faker.company.name(),
        ...overrides,
      };
    }

    it('유효한 다국어 데이터로 브랜드를 등록하면 204를 반환한다', async () => {
      // Given
      const body = buildV1PostBody();

      // When
      const res = await request(app.getHttpServer())
        .post(V1_BASE_URL)
        .set('Authorization', await authHeader(app))
        .send(body);

      // Then
      expect(res.status).toBe(204);
    });

    it('언어코드 기반으로 다국어 브랜드를 저장하면 각 언어별로 multilingual_text가 생성된다', async () => {
      // Given
      const auth = await authHeader(app);
      const koName = `한국어브랜드-${Date.now()}`;
      const enName = `English Brand-${Date.now()}`;
      const koDesc = '한국어 브랜드 설명';
      const enDesc = 'English brand description';

      const body = buildV1PostBody({
        englishName: 'TestBrand',
        languageList: [
          {
            languageCode: 'ko',
            name: koName,
            description: koDesc,
          },
          {
            languageCode: 'en',
            name: enName,
            description: enDesc,
          },
        ],
      });

      // When - v1 엔드포인트로 브랜드 생성
      const createRes = await request(app.getHttpServer())
        .post(V1_BASE_URL)
        .set('Authorization', auth)
        .send(body);

      // Then
      expect(createRes.status).toBe(204);

      // When - 목록에서 조회
      const listRes = await request(app.getHttpServer())
        .get(BASE_URL)
        .set('Authorization', auth);

      const brandId = listRes.body.data.list[0].id;

      // Then - DB에서 다국어 텍스트 확인
      const koTexts = await dataSource.query(
        `SELECT * FROM multilingual_text
         WHERE entity_type = 'brand' AND entity_id = $1
         AND field_name IN ('name', 'description')
         AND language_id = (SELECT id FROM language WHERE code = 'ko')`,
        [brandId],
      );

      const enTexts = await dataSource.query(
        `SELECT * FROM multilingual_text
         WHERE entity_type = 'brand' AND entity_id = $1
         AND field_name IN ('name', 'description')
         AND language_id = (SELECT id FROM language WHERE code = 'en')`,
        [brandId],
      );

      expect(koTexts.length).toBe(2); // name, description
      expect(enTexts.length).toBe(2);

      const koNameText = koTexts.find((t: any) => t.field_name === 'name');
      const enNameText = enTexts.find((t: any) => t.field_name === 'name');

      expect(koNameText.text_content).toBe(koName);
      expect(enNameText.text_content).toBe(enName);
    });

    it('섹션의 다국어 데이터가 languageCode 기반으로 저장된다', async () => {
      // Given
      const auth = await authHeader(app);
      const koSectionTitle = '브랜드 스토리-한국';
      const enSectionTitle = 'Brand Story-English';
      const koSectionContent = '한국 브랜드 스토리 내용';
      const enSectionContent = 'English brand story content';

      const body = buildV1PostBody({
        sectionList: [
          {
            languageList: [
              {
                languageCode: 'ko',
                title: koSectionTitle,
                content: koSectionContent,
              },
              {
                languageCode: 'en',
                title: enSectionTitle,
                content: enSectionContent,
              },
            ],
            imageUrlList: [faker.image.url()],
          },
        ],
      });

      // When
      const createRes = await request(app.getHttpServer())
        .post(V1_BASE_URL)
        .set('Authorization', auth)
        .send(body);

      expect(createRes.status).toBe(204);

      // When - 목록에서 조회
      const listRes = await request(app.getHttpServer())
        .get(BASE_URL)
        .set('Authorization', auth);

      const brandId = listRes.body.data.list[0].id;

      // Then - DB에서 섹션 다국어 텍스트 확인
      const sectionId = await dataSource.query(
        `SELECT id FROM brand_section WHERE brand_id = $1 LIMIT 1`,
        [brandId],
      );

      const koSectionTexts = await dataSource.query(
        `SELECT * FROM multilingual_text
         WHERE entity_type = 'brand_section' AND entity_id = $1
         AND language_id = (SELECT id FROM language WHERE code = 'ko')`,
        [sectionId[0].id],
      );

      const enSectionTexts = await dataSource.query(
        `SELECT * FROM multilingual_text
         WHERE entity_type = 'brand_section' AND entity_id = $1
         AND language_id = (SELECT id FROM language WHERE code = 'en')`,
        [sectionId[0].id],
      );

      expect(koSectionTexts.length).toBe(2); // title, content
      expect(enSectionTexts.length).toBe(2);

      const koTitle = koSectionTexts.find((t: any) => t.field_name === 'title');
      expect(koTitle.text_content).toBe(koSectionTitle);
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(V1_BASE_URL)
        .send({
          languageList: [
            {
              languageCode: 'ko',
              name: 'Test',
              description: 'Test',
            },
          ],
          categoryId,
          bannerImageUrlList: [faker.image.url()],
          mobileBannerImageUrlList: [faker.image.url()],
          productBannerImageUrl: faker.image.url(),
          englishName: 'Test',
          sectionList: [],
        });

      // Then
      expect(res.status).toBe(401);
    });

    it('필수 필드(languageList) 누락 시 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(V1_BASE_URL)
        .set('Authorization', await authHeader(app))
        .send({
          categoryId,
          bannerImageUrlList: [faker.image.url()],
          mobileBannerImageUrlList: [faker.image.url()],
          productBannerImageUrl: faker.image.url(),
          englishName: 'Test',
          sectionList: [],
        });

      // Then
      expect(res.status).toBe(400);
    });

    it('유효하지 않은 언어 코드는 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(V1_BASE_URL)
        .set('Authorization', await authHeader(app))
        .send({
          languageList: [
            {
              languageCode: 'invalid',
              name: 'Test',
              description: 'Test',
            },
          ],
          categoryId,
          bannerImageUrlList: [faker.image.url()],
          mobileBannerImageUrlList: [faker.image.url()],
          productBannerImageUrl: faker.image.url(),
          englishName: 'Test',
          sectionList: [],
        });

      // Then
      expect(res.status).toBe(400);
    });

    it('여러 섹션을 저장할 수 있다', async () => {
      // Given
      const auth = await authHeader(app);
      const body = buildV1PostBody({
        sectionList: [
          {
            languageList: [
              {
                languageCode: 'ko',
                title: '첫 번째 섹션',
                content: '첫 번째 섹션 내용',
              },
              {
                languageCode: 'en',
                title: 'First Section',
                content: 'First section content',
              },
            ],
            imageUrlList: [faker.image.url()],
          },
          {
            languageList: [
              {
                languageCode: 'ko',
                title: '두 번째 섹션',
                content: '두 번째 섹션 내용',
              },
              {
                languageCode: 'en',
                title: 'Second Section',
                content: 'Second section content',
              },
            ],
            imageUrlList: [faker.image.url(), faker.image.url()],
          },
        ],
      });

      // When
      const res = await request(app.getHttpServer())
        .post(V1_BASE_URL)
        .set('Authorization', auth)
        .send(body);

      expect(res.status).toBe(204);

      // When - 목록 조회
      const listRes = await request(app.getHttpServer())
        .get(BASE_URL)
        .set('Authorization', auth);

      const brandId = listRes.body.data.list[0].id;

      // Then - DB에서 섹션 개수 확인
      const sections = await dataSource.query(
        `SELECT id FROM brand_section WHERE brand_id = $1 ORDER BY id`,
        [brandId],
      );

      expect(sections.length).toBe(2);
    });

    it('colorCode가 저장된다', async () => {
      // Given
      const auth = await authHeader(app);
      const body = buildV1PostBody({ colorCode: '#FF0000' });

      // When
      const res = await request(app.getHttpServer())
        .post(V1_BASE_URL)
        .set('Authorization', auth)
        .send(body);

      // Then
      expect(res.status).toBe(204);

      const listRes = await request(app.getHttpServer())
        .get(V1_BASE_URL)
        .set('Authorization', auth);

      expect(listRes.body.data.list[0].colorCode).toBe('#FF0000');
    });

    it('배너 이미지와 모바일 배너 이미지가 저장된다', async () => {
      // Given
      const auth = await authHeader(app);
      const bannerUrl1 = faker.image.url();
      const bannerUrl2 = faker.image.url();
      const mobileBannerUrl = faker.image.url();

      const body = buildV1PostBody({
        bannerImageUrlList: [bannerUrl1, bannerUrl2],
        mobileBannerImageUrlList: [mobileBannerUrl],
      });

      // When
      const res = await request(app.getHttpServer())
        .post(V1_BASE_URL)
        .set('Authorization', auth)
        .send(body);

      expect(res.status).toBe(204);

      // When - 목록 조회
      const listRes = await request(app.getHttpServer())
        .get(BASE_URL)
        .set('Authorization', auth);

      const brandId = listRes.body.data.list[0].id;

      // Then - DB에서 배너 이미지 확인
      const bannerImages = await dataSource.query(
        `SELECT * FROM brand_banner_image WHERE brand_id = $1 ORDER BY sort_order`,
        [brandId],
      );

      const mobileBannerImages = await dataSource.query(
        `SELECT * FROM brand_mobile_banner_image WHERE brand_id = $1`,
        [brandId],
      );

      expect(bannerImages.length).toBe(2);
      expect(mobileBannerImages.length).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Helper: V1 브랜드 생성 후 ID 반환
  // -----------------------------------------------------------------------
  async function createV1Brand(
    auth: string,
    overrides?: Record<string, any>,
  ): Promise<number> {
    const body = {
      languageList: [
        {
          languageCode: 'ko',
          name: faker.company.name(),
          description: faker.company.catchPhrase(),
        },
        {
          languageCode: 'en',
          name: faker.company.name(),
          description: faker.company.catchPhrase(),
        },
      ],
      categoryId,
      profileImageUrl: faker.image.url(),
      sectionList: [
        {
          languageList: [
            {
              languageCode: 'ko',
              title: faker.lorem.sentence(),
              content: faker.lorem.paragraph(),
            },
            {
              languageCode: 'en',
              title: faker.lorem.sentence(),
              content: faker.lorem.paragraph(),
            },
          ],
          imageUrlList: [faker.image.url()],
        },
      ],
      bannerImageUrlList: [faker.image.url()],
      mobileBannerImageUrlList: [faker.image.url()],
      productBannerImageUrl: faker.image.url(),
      englishName: faker.company.name(),
      colorCode: '#ABCDEF',
      ...overrides,
    };

    await request(app.getHttpServer())
      .post(V1_BASE_URL)
      .set('Authorization', auth)
      .send(body);

    const listRes = await request(app.getHttpServer())
      .get(V1_BASE_URL)
      .set('Authorization', auth);

    return listRes.body.data.list[0].id;
  }

  // -----------------------------------------------------------------------
  // GET /admin/brand/v1
  // -----------------------------------------------------------------------
  describe('GET /admin/brand/v1', () => {
    it('브랜드가 없을 때 빈 배열을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .get(V1_BASE_URL)
        .set('Authorization', await authHeader(app));

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.list).toEqual([]);
    });

    it('브랜드 리스트에 다국어 이름이 포함된다', async () => {
      // Given
      const auth = await authHeader(app);
      const koName = `한국어-${Date.now()}`;
      const enName = `English-${Date.now()}`;

      await createV1Brand(auth, {
        languageList: [
          { languageCode: 'ko', name: koName, description: '설명' },
          { languageCode: 'en', name: enName, description: 'desc' },
        ],
      });

      // When
      const res = await request(app.getHttpServer())
        .get(V1_BASE_URL)
        .set('Authorization', auth);

      // Then
      expect(res.status).toBe(200);
      const brand = res.body.data.list[0];
      expect(brand.nameList).toBeDefined();
      expect(brand.nameList.length).toBeGreaterThanOrEqual(2);

      const koEntry = brand.nameList.find((n: any) => n.languageCode === 'ko');
      const enEntry = brand.nameList.find((n: any) => n.languageCode === 'en');
      expect(koEntry.name).toBe(koName);
      expect(enEntry.name).toBe(enName);
    });

    it('colorCode가 리스트에 포함된다', async () => {
      // Given
      const auth = await authHeader(app);
      await createV1Brand(auth, { colorCode: '#123456' });

      // When
      const res = await request(app.getHttpServer())
        .get(V1_BASE_URL)
        .set('Authorization', auth);

      // Then
      expect(res.body.data.list[0].colorCode).toBe('#123456');
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).get(V1_BASE_URL);

      // Then
      expect(res.status).toBe(401);
    });
  });

  // -----------------------------------------------------------------------
  // GET /admin/brand/v1/:id
  // -----------------------------------------------------------------------
  describe('GET /admin/brand/v1/:id', () => {
    it('브랜드 상세 조회 시 다국어 정보가 포함된다', async () => {
      // Given
      const auth = await authHeader(app);
      const koName = `상세조회-${Date.now()}`;
      const enName = `Detail-${Date.now()}`;
      const brandId = await createV1Brand(auth, {
        languageList: [
          { languageCode: 'ko', name: koName, description: '한국어설명' },
          { languageCode: 'en', name: enName, description: 'English desc' },
        ],
      });

      // When
      const res = await request(app.getHttpServer())
        .get(`${V1_BASE_URL}/${brandId}`)
        .set('Authorization', auth);

      // Then
      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.id).toBe(brandId);
      expect(data.languageList).toBeDefined();
      expect(data.languageList.length).toBeGreaterThanOrEqual(2);

      const ko = data.languageList.find((l: any) => l.languageCode === 'ko');
      const en = data.languageList.find((l: any) => l.languageCode === 'en');
      expect(ko.name).toBe(koName);
      expect(en.name).toBe(enName);
    });

    it('섹션 정보가 상세 조회에 포함된다', async () => {
      // Given
      const auth = await authHeader(app);
      const koTitle = '섹션제목-한국어';
      const brandId = await createV1Brand(auth, {
        sectionList: [
          {
            languageList: [
              {
                languageCode: 'ko',
                title: koTitle,
                content: '섹션내용',
              },
              {
                languageCode: 'en',
                title: 'Section Title',
                content: 'Section content',
              },
            ],
            imageUrlList: [faker.image.url()],
          },
        ],
      });

      // When
      const res = await request(app.getHttpServer())
        .get(`${V1_BASE_URL}/${brandId}`)
        .set('Authorization', auth);

      // Then
      expect(res.status).toBe(200);
      const ko = res.body.data.languageList.find(
        (l: any) => l.languageCode === 'ko',
      );
      expect(ko.section).toBeDefined();
      expect(ko.section.length).toBe(1);
      expect(ko.section[0].title).toBe(koTitle);
    });

    it('배너/모바일배너 이미지 URL 리스트가 포함된다', async () => {
      // Given
      const auth = await authHeader(app);
      const brandId = await createV1Brand(auth, {
        bannerImageUrlList: [faker.image.url(), faker.image.url()],
        mobileBannerImageUrlList: [faker.image.url()],
      });

      // When
      const res = await request(app.getHttpServer())
        .get(`${V1_BASE_URL}/${brandId}`)
        .set('Authorization', auth);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.bannerImageUrlList.length).toBe(2);
      expect(res.body.data.mobileBannerImageUrlList.length).toBe(1);
    });

    it('존재하지 않는 브랜드 조회 시 에러를 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .get(`${V1_BASE_URL}/999999`)
        .set('Authorization', await authHeader(app));

      // Then
      expect(res.status).not.toBe(200);
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).get(`${V1_BASE_URL}/1`);

      // Then
      expect(res.status).toBe(401);
    });
  });

  // -----------------------------------------------------------------------
  // PATCH /admin/brand/v1/:id
  // -----------------------------------------------------------------------
  describe('PATCH /admin/brand/v1/:id', () => {
    it('브랜드 이름을 수정하면 변경된 값이 조회된다', async () => {
      // Given
      const auth = await authHeader(app);
      const brandId = await createV1Brand(auth);
      const updatedKoName = `수정됨-${Date.now()}`;

      // When
      const res = await request(app.getHttpServer())
        .patch(`${V1_BASE_URL}/${brandId}`)
        .set('Authorization', auth)
        .send({
          categoryId,
          englishName: faker.company.name(),
          profileImageUrl: faker.image.url(),
          productBannerImageUrl: faker.image.url(),
          bannerImageUrlList: [faker.image.url()],
          mobileBannerImageUrlList: [faker.image.url()],
          languageList: [
            {
              languageCode: 'ko',
              name: updatedKoName,
              description: '수정된 설명',
              section: [],
            },
            {
              languageCode: 'en',
              name: 'Updated Name',
              description: 'Updated desc',
              section: [],
            },
          ],
        });

      // Then
      expect(res.status).toBe(202);

      // When - 상세 조회
      const detailRes = await request(app.getHttpServer())
        .get(`${V1_BASE_URL}/${brandId}`)
        .set('Authorization', auth);

      const ko = detailRes.body.data.languageList.find(
        (l: any) => l.languageCode === 'ko',
      );
      expect(ko.name).toBe(updatedKoName);
    });

    it('colorCode를 수정하면 변경된 값이 조회된다', async () => {
      // Given
      const auth = await authHeader(app);
      const brandId = await createV1Brand(auth, {
        colorCode: '#000000',
      });

      // When
      const res = await request(app.getHttpServer())
        .patch(`${V1_BASE_URL}/${brandId}`)
        .set('Authorization', auth)
        .send({
          categoryId,
          englishName: faker.company.name(),
          profileImageUrl: faker.image.url(),
          productBannerImageUrl: faker.image.url(),
          bannerImageUrlList: [faker.image.url()],
          mobileBannerImageUrlList: [faker.image.url()],
          languageList: [
            {
              languageCode: 'ko',
              name: faker.company.name(),
              description: faker.company.catchPhrase(),
              section: [],
            },
            {
              languageCode: 'en',
              name: faker.company.name(),
              description: faker.company.catchPhrase(),
              section: [],
            },
          ],
          colorCode: '#FFFFFF',
        });

      // Then
      expect(res.status).toBe(202);

      const detailRes = await request(app.getHttpServer())
        .get(`${V1_BASE_URL}/${brandId}`)
        .set('Authorization', auth);

      expect(detailRes.body.data.colorCode).toBe('#FFFFFF');
    });

    it('배너 이미지를 교체하면 새 값이 조회된다', async () => {
      // Given
      const auth = await authHeader(app);
      const brandId = await createV1Brand(auth);
      const newBanner = faker.image.url();

      // When
      const res = await request(app.getHttpServer())
        .patch(`${V1_BASE_URL}/${brandId}`)
        .set('Authorization', auth)
        .send({
          categoryId,
          englishName: faker.company.name(),
          profileImageUrl: faker.image.url(),
          productBannerImageUrl: faker.image.url(),
          bannerImageUrlList: [newBanner],
          mobileBannerImageUrlList: [faker.image.url()],
          languageList: [
            {
              languageCode: 'ko',
              name: faker.company.name(),
              description: faker.company.catchPhrase(),
              section: [],
            },
            {
              languageCode: 'en',
              name: faker.company.name(),
              description: faker.company.catchPhrase(),
              section: [],
            },
          ],
        });

      // Then
      expect(res.status).toBe(202);

      const detailRes = await request(app.getHttpServer())
        .get(`${V1_BASE_URL}/${brandId}`)
        .set('Authorization', auth);

      expect(detailRes.body.data.bannerImageUrlList.length).toBe(1);
      expect(detailRes.body.data.bannerImageUrlList[0]).toBe(newBanner);
    });

    it('존재하지 않는 브랜드 수정 시 에러를 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .patch(`${V1_BASE_URL}/999999`)
        .set('Authorization', await authHeader(app))
        .send({
          categoryId,
          englishName: faker.company.name(),
          profileImageUrl: faker.image.url(),
          productBannerImageUrl: faker.image.url(),
          bannerImageUrlList: [faker.image.url()],
          mobileBannerImageUrlList: [faker.image.url()],
          languageList: [
            {
              languageCode: 'ko',
              name: faker.company.name(),
              description: faker.company.catchPhrase(),
              section: [],
            },
          ],
          colorCode: '#111111',
        });

      // Then
      expect(res.status).not.toBe(202);
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .patch(`${V1_BASE_URL}/1`)
        .send({ colorCode: '#111111' });

      // Then
      expect(res.status).toBe(401);
    });

    it('다국어 정보와 필수 필드를 모두 포함하여 수정하면 변경된 값이 조회된다', async () => {
      // Given
      const auth = await authHeader(app);
      const brandId = await createV1Brand(auth);
      const updatedKoName = `한글명-수정-${Date.now()}`;

      // When - PATCH 요청 시 필수 필드 모두 포함
      const res = await request(app.getHttpServer())
        .patch(`${V1_BASE_URL}/${brandId}`)
        .set('Authorization', auth)
        .send({
          languageList: [
            {
              languageCode: 'ko',
              name: updatedKoName,
              description: '수정된 한글 설명',
              section: [],
            },
            {
              languageCode: 'en',
              name: 'Updated English Name',
              description: 'Updated English description',
              section: [],
            },
          ],
          categoryId,
          englishName: 'Updated English Name',
          profileImageUrl: faker.image.url(),
          productBannerImageUrl: faker.image.url(),
          bannerImageUrlList: [faker.image.url()],
          mobileBannerImageUrlList: [faker.image.url()],
        });

      // Then
      expect(res.status).toBe(202);

      // When - 상세 조회
      const detailRes = await request(app.getHttpServer())
        .get(`${V1_BASE_URL}/${brandId}`)
        .set('Authorization', auth);

      expect(detailRes.status).toBe(200);
      const koLang = detailRes.body.data.languageList.find(
        (l: any) => l.languageCode === 'ko',
      );
      expect(koLang).toBeDefined();
      expect(koLang.name).toBe(updatedKoName);
      expect(koLang.description).toBe('수정된 한글 설명');
    });

    it('모든 필수 필드를 수정하면 변경된 값들이 조회된다', async () => {
      // Given
      const auth = await authHeader(app);
      const brandId = await createV1Brand(auth);
      const newEnglishName = `English-${Date.now()}`;
      const newProductBanner = faker.image.url();
      const newBanner = faker.image.url();
      const newMobileBanner = faker.image.url();

      // When
      const res = await request(app.getHttpServer())
        .patch(`${V1_BASE_URL}/${brandId}`)
        .set('Authorization', auth)
        .send({
          languageList: [
            {
              languageCode: 'ko',
              name: '한글명',
              description: '한글 설명',
              section: [],
            },
            {
              languageCode: 'en',
              name: 'English Name',
              description: 'English description',
              section: [],
            },
          ],
          categoryId,
          englishName: newEnglishName,
          profileImageUrl: faker.image.url(),
          productBannerImageUrl: newProductBanner,
          bannerImageUrlList: [newBanner],
          mobileBannerImageUrlList: [newMobileBanner],
        });

      // Then
      expect(res.status).toBe(202);

      // When - 상세 조회
      const detailRes = await request(app.getHttpServer())
        .get(`${V1_BASE_URL}/${brandId}`)
        .set('Authorization', auth);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.englishName).toBe(newEnglishName);
      expect(detailRes.body.data.productBannerImageUrl).toBe(newProductBanner);
      expect(detailRes.body.data.bannerImageUrlList).toContain(newBanner);
      expect(detailRes.body.data.mobileBannerImageUrlList).toContain(
        newMobileBanner,
      );
    });
  });
});

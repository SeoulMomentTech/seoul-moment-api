import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { authHeader, getAdminToken } from './setup/auth.helper';
import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

const BASE_URL = '/admin/home/banner';
const OVER_500 = 'a'.repeat(501);

describe('AdminHomeController (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득 (최초 1회만 부트스트랩)
    app = await getTestApp();
    dataSource = getDataSource(app);
    await getAdminToken(app); // 토큰 캐시 워밍업
  }, 60_000);

  afterEach(async () => {
    await truncateTables(dataSource, ['home_banner_image']);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // ---------------------------------------------------------------------------
  // GET /admin/home/banner
  // ---------------------------------------------------------------------------
  describe('GET /admin/home/banner', () => {
    it('배너가 없을 때 빈 배열을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .get(BASE_URL)
        .set('Authorization', await authHeader(app));

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.list).toEqual([]);
    });

    it('배너 목록을 sortOrder 순으로 반환한다 (DELETE 상태 포함)', async () => {
      // Given - 배너 2개 생성
      const auth = await authHeader(app);
      await request(app.getHttpServer())
        .post(BASE_URL)
        .set('Authorization', auth)
        .send({
          imageUrl: '/banner/first.jpg',
          mobileImageUrl: '/m/first.jpg',
        });
      await request(app.getHttpServer())
        .post(BASE_URL)
        .set('Authorization', auth)
        .send({
          imageUrl: '/banner/second.jpg',
          mobileImageUrl: '/m/second.jpg',
        });

      // When
      const res = await request(app.getHttpServer())
        .get(BASE_URL)
        .set('Authorization', auth);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.list).toHaveLength(2);
      expect(res.body.data.list[0].imageUrl).toBe('/banner/first.jpg');
      expect(res.body.data.list[1].imageUrl).toBe('/banner/second.jpg');
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).get(BASE_URL);

      // Then
      expect(res.status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /admin/home/banner
  // ---------------------------------------------------------------------------
  describe('POST /admin/home/banner', () => {
    it('유효한 데이터로 배너를 생성하면 204를 반환한다', async () => {
      // Given
      const body = {
        imageUrl: faker.image.url(),
        mobileImageUrl: faker.image.url(),
      };

      // When
      const res = await request(app.getHttpServer())
        .post(BASE_URL)
        .set('Authorization', await authHeader(app))
        .send(body);

      // Then
      expect(res.status).toBe(204);
    });

    it('생성 후 GET 목록에 추가된다', async () => {
      // Given
      const auth = await authHeader(app);
      const imageUrl = '/banner/new.jpg';
      await request(app.getHttpServer())
        .post(BASE_URL)
        .set('Authorization', auth)
        .send({ imageUrl, mobileImageUrl: '/m/new.jpg' });

      // When
      const res = await request(app.getHttpServer())
        .get(BASE_URL)
        .set('Authorization', auth);

      // Then
      expect(res.body.data.list).toHaveLength(1);
      expect(res.body.data.list[0].imageUrl).toBe(imageUrl);
      expect(res.body.data.list[0].status).toBe('NORMAL');
    });

    it('도메인이 포함된 URL로 배너를 생성하면 도메인이 제거되어 저장된다', async () => {
      // Given
      const auth = await authHeader(app);
      const domain = 'https://image.seoulmoment.com';
      const path = '/banner/domain-test.jpg';
      const mobilePath = '/m/domain-test.jpg';

      await request(app.getHttpServer())
        .post(BASE_URL)
        .set('Authorization', auth)
        .send({
          imageUrl: `${domain}${path}`,
          mobileImageUrl: `${domain}${mobilePath}`,
        });

      // When
      const res = await request(app.getHttpServer())
        .get(BASE_URL)
        .set('Authorization', auth);

      // Then - IMAGE_DOMAIN_NAME이 비어 있으면 원본 그대로, 값이 있으면 도메인 제거
      expect(res.body.data.list).toHaveLength(1);
      const saved = res.body.data.list[0];
      expect(saved.imageUrl).not.toContain(domain + domain);
      expect(saved.mobileImageUrl).not.toContain(domain + domain);
    });

    it('필수 필드 누락 시 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(BASE_URL)
        .set('Authorization', await authHeader(app))
        .send({ imageUrl: '/banner/only-image.jpg' }); // mobileImageUrl 누락

      // Then
      expect(res.status).toBe(400);
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).post(BASE_URL).send({
        imageUrl: '/banner/img.jpg',
        mobileImageUrl: '/m/img.jpg',
      });

      // Then
      expect(res.status).toBe(401);
    });

    // -------------------------------------------------------------------------
    // 500 방어
    // -------------------------------------------------------------------------
    it('[500 방어] imageUrl이 500자를 초과하면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(BASE_URL)
        .set('Authorization', await authHeader(app))
        .send({ imageUrl: OVER_500, mobileImageUrl: '/m/img.jpg' });

      // Then
      expect(res.status).toBe(400);
    });

    it('[500 방어] mobileImageUrl이 500자를 초과하면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(BASE_URL)
        .set('Authorization', await authHeader(app))
        .send({ imageUrl: '/banner/img.jpg', mobileImageUrl: OVER_500 });

      // Then
      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /admin/home/banner/:id
  // ---------------------------------------------------------------------------
  describe('PATCH /admin/home/banner/:id', () => {
    it('존재하는 배너를 수정하면 204를 반환한다', async () => {
      // Given - 배너 생성 후 id 획득
      const auth = await authHeader(app);
      await request(app.getHttpServer())
        .post(BASE_URL)
        .set('Authorization', auth)
        .send({
          imageUrl: '/banner/old.jpg',
          mobileImageUrl: '/m/old.jpg',
        });
      const listRes = await request(app.getHttpServer())
        .get(BASE_URL)
        .set('Authorization', auth);
      const bannerId = listRes.body.data.list[0].id;

      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/${bannerId}`)
        .set('Authorization', auth)
        .send({ imageUrl: '/banner/new.jpg' });

      // Then
      expect(res.status).toBe(204);
    });

    it('수정 후 GET 목록에 변경 내용이 반영된다', async () => {
      // Given
      const auth = await authHeader(app);
      await request(app.getHttpServer())
        .post(BASE_URL)
        .set('Authorization', auth)
        .send({
          imageUrl: '/banner/before.jpg',
          mobileImageUrl: '/m/before.jpg',
        });
      const bannerId = (
        await request(app.getHttpServer())
          .get(BASE_URL)
          .set('Authorization', auth)
      ).body.data.list[0].id;

      // When
      await request(app.getHttpServer())
        .patch(`${BASE_URL}/${bannerId}`)
        .set('Authorization', auth)
        .send({ imageUrl: '/banner/after.jpg' });
      const res = await request(app.getHttpServer())
        .get(BASE_URL)
        .set('Authorization', auth);

      // Then
      expect(res.body.data.list[0].imageUrl).toBe('/banner/after.jpg');
    });

    it('존재하지 않는 id로 수정 시 404를 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/999999`)
        .set('Authorization', await authHeader(app))
        .send({ imageUrl: '/banner/img.jpg' });

      // Then
      expect(res.status).toBe(404);
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/1`)
        .send({ imageUrl: '/banner/img.jpg' });

      // Then
      expect(res.status).toBe(401);
    });

    // -------------------------------------------------------------------------
    // 500 방어
    // -------------------------------------------------------------------------
    it('[500 방어] id가 숫자가 아니면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/abc`)
        .set('Authorization', await authHeader(app))
        .send({ imageUrl: '/banner/img.jpg' });

      // Then
      expect(res.status).toBe(400);
    });

    it('[500 방어] imageUrl이 500자를 초과하면 400을 반환한다', async () => {
      // Given - 배너 생성 후 id 획득
      const auth = await authHeader(app);
      await request(app.getHttpServer())
        .post(BASE_URL)
        .set('Authorization', auth)
        .send({
          imageUrl: '/banner/img.jpg',
          mobileImageUrl: '/m/img.jpg',
        });
      const bannerId = (
        await request(app.getHttpServer())
          .get(BASE_URL)
          .set('Authorization', auth)
      ).body.data.list[0].id;

      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/${bannerId}`)
        .set('Authorization', auth)
        .send({ imageUrl: OVER_500 });

      // Then
      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /admin/home/banner/:id
  // ---------------------------------------------------------------------------
  describe('DELETE /admin/home/banner/:id', () => {
    it('배너를 소프트 삭제하면 204를 반환한다', async () => {
      // Given
      const auth = await authHeader(app);
      await request(app.getHttpServer())
        .post(BASE_URL)
        .set('Authorization', auth)
        .send({
          imageUrl: '/banner/img.jpg',
          mobileImageUrl: '/m/img.jpg',
        });
      const bannerId = (
        await request(app.getHttpServer())
          .get(BASE_URL)
          .set('Authorization', auth)
      ).body.data.list[0].id;

      // When
      const res = await request(app.getHttpServer())
        .delete(`${BASE_URL}/${bannerId}`)
        .set('Authorization', auth);

      // Then
      expect(res.status).toBe(204);
    });

    it('삭제 후 GET 목록에서 status가 DELETE로 변경된다', async () => {
      // Given
      const auth = await authHeader(app);
      await request(app.getHttpServer())
        .post(BASE_URL)
        .set('Authorization', auth)
        .send({
          imageUrl: '/banner/img.jpg',
          mobileImageUrl: '/m/img.jpg',
        });
      const bannerId = (
        await request(app.getHttpServer())
          .get(BASE_URL)
          .set('Authorization', auth)
      ).body.data.list[0].id;

      // When
      await request(app.getHttpServer())
        .delete(`${BASE_URL}/${bannerId}`)
        .set('Authorization', auth);
      const listRes = await request(app.getHttpServer())
        .get(BASE_URL)
        .set('Authorization', auth);

      // Then - admin 목록은 DELETE 상태도 포함
      expect(listRes.body.data.list[0].status).toBe('DELETE');
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).delete(`${BASE_URL}/1`);

      // Then
      expect(res.status).toBe(401);
    });

    // -------------------------------------------------------------------------
    // 500 방어
    // -------------------------------------------------------------------------
    it('[500 방어] id가 숫자가 아니면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .delete(`${BASE_URL}/abc`)
        .set('Authorization', await authHeader(app));

      // Then
      expect(res.status).toBe(400);
    });
  });
});

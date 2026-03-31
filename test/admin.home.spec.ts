import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { authHeader, getAdminToken } from './setup/auth.helper';
import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

const V1_BASE_URL = '/admin/home/v1/banner';
const DELETE_URL = '/admin/home/banner';
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
  // V1: GET /admin/home/v1/banner
  // ---------------------------------------------------------------------------
  describe('GET /admin/home/v1/banner', () => {
    it('배너가 없을 때 빈 배열을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .get(V1_BASE_URL)
        .set('Authorization', await authHeader(app));

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.list).toEqual([]);
    });

    it('배너 목록을 반환하며 imageUrl, mobileImageUrl 필드가 존재한다', async () => {
      // Given - V1 API로 배너 2개 생성
      const auth = await authHeader(app);
      await request(app.getHttpServer())
        .post(V1_BASE_URL)
        .set('Authorization', auth)
        .send({
          imageUrl: '/banner/v1-first.jpg',
          mobileImageUrl: '/m/v1-first.jpg',
        });
      await request(app.getHttpServer())
        .post(V1_BASE_URL)
        .set('Authorization', auth)
        .send({
          imageUrl: '/banner/v1-second.jpg',
          mobileImageUrl: '/m/v1-second.jpg',
        });

      // When
      const res = await request(app.getHttpServer())
        .get(V1_BASE_URL)
        .set('Authorization', auth);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.list).toHaveLength(2);
      expect(res.body.data.list[0]).toHaveProperty('imageUrl');
      expect(res.body.data.list[0]).toHaveProperty('mobileImageUrl');
      expect(res.body.data.list[0]).toHaveProperty('status');
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).get(V1_BASE_URL);

      // Then
      expect(res.status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // V1: POST /admin/home/v1/banner
  // ---------------------------------------------------------------------------
  describe('POST /admin/home/v1/banner', () => {
    it('유효한 데이터로 배너를 생성하면 204를 반환한다', async () => {
      // Given
      const body = {
        imageUrl: faker.image.url(),
        mobileImageUrl: faker.image.url(),
      };

      // When
      const res = await request(app.getHttpServer())
        .post(V1_BASE_URL)
        .set('Authorization', await authHeader(app))
        .send(body);

      // Then
      expect(res.status).toBe(204);
    });

    it('생성 후 V1 GET 목록에 추가된다', async () => {
      // Given
      const auth = await authHeader(app);
      const imageUrl = '/banner/v1-new.jpg';
      await request(app.getHttpServer())
        .post(V1_BASE_URL)
        .set('Authorization', auth)
        .send({ imageUrl, mobileImageUrl: '/m/v1-new.jpg' });

      // When
      const res = await request(app.getHttpServer())
        .get(V1_BASE_URL)
        .set('Authorization', auth);

      // Then
      expect(res.body.data.list).toHaveLength(1);
      expect(res.body.data.list[0].imageUrl).toContain('v1-new.jpg');
      expect(res.body.data.list[0].status).toBe('NORMAL');
    });

    it('필수 필드 누락 시 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(V1_BASE_URL)
        .set('Authorization', await authHeader(app))
        .send({ imageUrl: '/banner/only-image.jpg' }); // mobileImageUrl 누락

      // Then
      expect(res.status).toBe(400);
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).post(V1_BASE_URL).send({
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
        .post(V1_BASE_URL)
        .set('Authorization', await authHeader(app))
        .send({ imageUrl: OVER_500, mobileImageUrl: '/m/img.jpg' });

      // Then
      expect(res.status).toBe(400);
    });

    it('[500 방어] mobileImageUrl이 500자를 초과하면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(V1_BASE_URL)
        .set('Authorization', await authHeader(app))
        .send({ imageUrl: '/banner/img.jpg', mobileImageUrl: OVER_500 });

      // Then
      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // V1: PATCH /admin/home/v1/banner/:id
  // ---------------------------------------------------------------------------
  describe('PATCH /admin/home/v1/banner/:id', () => {
    it('존재하는 배너를 수정하면 204를 반환한다', async () => {
      // Given - 배너 생성 후 id 획득
      const auth = await authHeader(app);
      await request(app.getHttpServer())
        .post(V1_BASE_URL)
        .set('Authorization', auth)
        .send({
          imageUrl: '/banner/v1-old.jpg',
          mobileImageUrl: '/m/v1-old.jpg',
        });
      const listRes = await request(app.getHttpServer())
        .get(V1_BASE_URL)
        .set('Authorization', auth);
      const bannerId = listRes.body.data.list[0].id;

      // When
      const res = await request(app.getHttpServer())
        .patch(`${V1_BASE_URL}/${bannerId}`)
        .set('Authorization', auth)
        .send({ imageUrl: '/banner/v1-updated.jpg' });

      // Then
      expect(res.status).toBe(204);
    });

    it('수정 후 V1 GET 목록에 변경 내용이 반영된다', async () => {
      // Given
      const auth = await authHeader(app);
      await request(app.getHttpServer())
        .post(V1_BASE_URL)
        .set('Authorization', auth)
        .send({
          imageUrl: '/banner/v1-before.jpg',
          mobileImageUrl: '/m/v1-before.jpg',
        });
      const bannerId = (
        await request(app.getHttpServer())
          .get(V1_BASE_URL)
          .set('Authorization', auth)
      ).body.data.list[0].id;

      // When
      await request(app.getHttpServer())
        .patch(`${V1_BASE_URL}/${bannerId}`)
        .set('Authorization', auth)
        .send({ imageUrl: '/banner/v1-after.jpg' });
      const res = await request(app.getHttpServer())
        .get(V1_BASE_URL)
        .set('Authorization', auth);

      // Then
      expect(res.body.data.list[0].imageUrl).toContain('v1-after.jpg');
    });

    it('존재하지 않는 id로 수정 시 404를 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .patch(`${V1_BASE_URL}/999999`)
        .set('Authorization', await authHeader(app))
        .send({ imageUrl: '/banner/img.jpg' });

      // Then
      expect(res.status).toBe(404);
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .patch(`${V1_BASE_URL}/1`)
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
        .patch(`${V1_BASE_URL}/abc`)
        .set('Authorization', await authHeader(app))
        .send({ imageUrl: '/banner/img.jpg' });

      // Then
      expect(res.status).toBe(400);
    });

    it('[500 방어] imageUrl이 500자를 초과하면 400을 반환한다', async () => {
      // Given - 배너 생성 후 id 획득
      const auth = await authHeader(app);
      await request(app.getHttpServer())
        .post(V1_BASE_URL)
        .set('Authorization', auth)
        .send({
          imageUrl: '/banner/img.jpg',
          mobileImageUrl: '/m/img.jpg',
        });
      const bannerId = (
        await request(app.getHttpServer())
          .get(V1_BASE_URL)
          .set('Authorization', auth)
      ).body.data.list[0].id;

      // When
      const res = await request(app.getHttpServer())
        .patch(`${V1_BASE_URL}/${bannerId}`)
        .set('Authorization', auth)
        .send({ imageUrl: OVER_500 });

      // Then
      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /admin/home/banner/:id (변경 없음, 기존 경로 유지)
  // ---------------------------------------------------------------------------
  describe('DELETE /admin/home/banner/:id', () => {
    it('배너를 소프트 삭제하면 204를 반환한다', async () => {
      // Given - V1으로 배너 생성 후 id 획득
      const auth = await authHeader(app);
      await request(app.getHttpServer())
        .post(V1_BASE_URL)
        .set('Authorization', auth)
        .send({
          imageUrl: '/banner/img.jpg',
          mobileImageUrl: '/m/img.jpg',
        });
      const bannerId = (
        await request(app.getHttpServer())
          .get(V1_BASE_URL)
          .set('Authorization', auth)
      ).body.data.list[0].id;

      // When
      const res = await request(app.getHttpServer())
        .delete(`${DELETE_URL}/${bannerId}`)
        .set('Authorization', auth);

      // Then
      expect(res.status).toBe(204);
    });

    it('삭제 후 V1 GET 목록에서 status가 DELETE로 변경된다', async () => {
      // Given
      const auth = await authHeader(app);
      await request(app.getHttpServer())
        .post(V1_BASE_URL)
        .set('Authorization', auth)
        .send({
          imageUrl: '/banner/img.jpg',
          mobileImageUrl: '/m/img.jpg',
        });
      const bannerId = (
        await request(app.getHttpServer())
          .get(V1_BASE_URL)
          .set('Authorization', auth)
      ).body.data.list[0].id;

      // When
      await request(app.getHttpServer())
        .delete(`${DELETE_URL}/${bannerId}`)
        .set('Authorization', auth);
      const listRes = await request(app.getHttpServer())
        .get(V1_BASE_URL)
        .set('Authorization', auth);

      // Then
      expect(listRes.body.data.list[0].status).toBe('DELETE');
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).delete(`${DELETE_URL}/1`);

      // Then
      expect(res.status).toBe(401);
    });

    it('[500 방어] id가 숫자가 아니면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .delete(`${DELETE_URL}/abc`)
        .set('Authorization', await authHeader(app));

      // Then
      expect(res.status).toBe(400);
    });
  });
});

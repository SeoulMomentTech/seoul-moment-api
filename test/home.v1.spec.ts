import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { authHeader, getAdminToken } from './setup/auth.helper';
import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

const V1_HOME_URL = '/home/v1';
const V1_ADMIN_BANNER_URL = '/admin/home/v1/banner';

describe('HomeV1Controller (E2E)', () => {
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
  // GET /home/v1
  // ---------------------------------------------------------------------------
  describe('GET /home/v1', () => {
    it('Accept-language 헤더 없이 요청하면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).get(V1_HOME_URL);

      // Then
      expect(res.status).toBe(400);
    });

    it('유효하지 않은 Accept-language 값으로 요청하면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .get(V1_HOME_URL)
        .set('Accept-language', 'invalid');

      // Then
      expect(res.status).toBe(400);
    });

    it('ko 언어로 요청하면 200과 banner 배열을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .get(V1_HOME_URL)
        .set('Accept-language', 'ko');

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('banner');
      expect(Array.isArray(res.body.data.banner)).toBe(true);
    });

    it('en 언어로 요청해도 200을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .get(V1_HOME_URL)
        .set('Accept-language', 'en');

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('banner');
    });

    it('배너가 있을 때 banner 항목에 imageUrl, mobileImageUrl 필드가 존재한다', async () => {
      // Given - admin V1 API로 배너 생성
      const auth = await authHeader(app);
      await request(app.getHttpServer())
        .post(V1_ADMIN_BANNER_URL)
        .set('Authorization', auth)
        .send({
          imageUrl: '/banner/v1-home-test.jpg',
          mobileImageUrl: '/m/v1-home-test.jpg',
        });

      // When
      const res = await request(app.getHttpServer())
        .get(V1_HOME_URL)
        .set('Accept-language', 'ko');

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.banner).toHaveLength(1);
      expect(res.body.data.banner[0]).toHaveProperty('imageUrl');
      expect(res.body.data.banner[0]).toHaveProperty('mobileImageUrl');
      expect(res.body.data.banner[0].imageUrl).toContain('v1-home-test.jpg');
      expect(res.body.data.banner[0].mobileImageUrl).toContain(
        'v1-home-test.jpg',
      );
    });

    it('삭제된 배너는 공개 API에서 조회되지 않는다', async () => {
      // Given - 배너 생성 후 삭제
      const auth = await authHeader(app);
      await request(app.getHttpServer())
        .post(V1_ADMIN_BANNER_URL)
        .set('Authorization', auth)
        .send({
          imageUrl: '/banner/v1-to-delete.jpg',
          mobileImageUrl: '/m/v1-to-delete.jpg',
        });

      const listRes = await request(app.getHttpServer())
        .get(V1_ADMIN_BANNER_URL)
        .set('Authorization', auth);
      const bannerId = listRes.body.data.list[0].id;

      // 기존 deprecated DELETE 엔드포인트 사용 (V1에 DELETE 없음)
      await request(app.getHttpServer())
        .delete(`/admin/home/banner/${bannerId}`)
        .set('Authorization', auth);

      // When
      const res = await request(app.getHttpServer())
        .get(V1_HOME_URL)
        .set('Accept-language', 'ko');

      // Then - 삭제된 배너는 공개 API에서 보이지 않아야 함
      expect(res.status).toBe(200);
      const bannerUrls = res.body.data.banner.map(
        (b: { imageUrl: string }) => b.imageUrl,
      );
      expect(bannerUrls).not.toContain(
        expect.stringContaining('v1-to-delete.jpg'),
      );
    });
  });
});

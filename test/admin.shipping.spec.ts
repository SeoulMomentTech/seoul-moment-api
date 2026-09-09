import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { clearTokenCache, getAdminToken } from './setup/auth.helper';
import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

const ADMIN_BASE = '/admin/shipping';
const PUBLIC_POLICY = '/shipping-policy';

describe('AdminShippingController (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득 (최초 1회만 부트스트랩)
    app = await getTestApp();
    dataSource = getDataSource(app);

    // 다른 spec 이 admin 테이블을 비웠을 수 있어 캐시를 버리고 다시 받는다
    clearTokenCache();
    adminToken = await getAdminToken(app);
  }, 60_000);

  afterEach(async () => {
    await truncateTables(dataSource, [
      'shipping_remote_area',
      'shipping_policy',
    ]);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  function adminRequest() {
    return {
      get: (path: string) =>
        request(app.getHttpServer())
          .get(`${ADMIN_BASE}${path}`)
          .set('Authorization', `Bearer ${adminToken}`),
      patch: (path: string) =>
        request(app.getHttpServer())
          .patch(`${ADMIN_BASE}${path}`)
          .set('Authorization', `Bearer ${adminToken}`),
      post: (path: string) =>
        request(app.getHttpServer())
          .post(`${ADMIN_BASE}${path}`)
          .set('Authorization', `Bearer ${adminToken}`),
      delete: (path: string) =>
        request(app.getHttpServer())
          .delete(`${ADMIN_BASE}${path}`)
          .set('Authorization', `Bearer ${adminToken}`),
    };
  }

  // -------------------------------------------------------------------------
  describe('GET /shipping-policy (공개)', () => {
    it('정책 행이 없어도 운영 초기값으로 만들어 반환한다', async () => {
      // Given - shipping_policy 가 비어 있는 상태

      // When
      const res = await request(app.getHttpServer()).get(PUBLIC_POLICY);

      // Then - 본섬 60 / 외섬 100 / 프로모션 진행 중 / 무료배송 1150
      expect(res.status).toBe(200);
      expect(res.body.data.baseFee).toBe(60);
      expect(res.body.data.remoteIslandFee).toBe(100);
      expect(res.body.data.remoteIslandPromotion).toBe(true);
      expect(res.body.data.freeShippingThreshold).toBe(1150);

      const rows = await dataSource.query(`SELECT id FROM shipping_policy`);
      expect(rows).toHaveLength(1);
    });

    it('인증 없이 조회할 수 있다', async () => {
      // When
      const res = await request(app.getHttpServer()).get(PUBLIC_POLICY);

      // Then
      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  describe('PATCH /admin/shipping/policy', () => {
    it('요율을 수정하면 공개 조회에도 반영된다', async () => {
      // Given
      await adminRequest().get('/policy');

      // When
      const patchRes = await adminRequest().patch('/policy').send({
        baseFee: 80,
        freeShippingThreshold: 2000,
      });

      // Then
      expect(patchRes.status).toBe(204);

      const publicRes = await request(app.getHttpServer()).get(PUBLIC_POLICY);
      expect(publicRes.body.data.baseFee).toBe(80);
      expect(publicRes.body.data.freeShippingThreshold).toBe(2000);
      // 안 보낸 값은 그대로 남는다
      expect(publicRes.body.data.remoteIslandFee).toBe(100);
    });

    it('프로모션을 끄면 외섬 정상 요금이 살아난다', async () => {
      // Given - 프로모션 종료는 플래그 하나로 끝나야 한다
      await adminRequest().get('/policy');

      // When
      const res = await adminRequest()
        .patch('/policy')
        .send({ remoteIslandPromotion: false });

      // Then
      expect(res.status).toBe(204);

      const publicRes = await request(app.getHttpServer()).get(PUBLIC_POLICY);
      expect(publicRes.body.data.remoteIslandPromotion).toBe(false);
      expect(publicRes.body.data.remoteIslandFee).toBe(100);
    });

    it('음수 요율은 400을 반환한다', async () => {
      // When
      const res = await adminRequest().patch('/policy').send({ baseFee: -1 });

      // Then
      expect(res.status).toBe(400);
    });

    it('토큰이 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .patch(`${ADMIN_BASE}/policy`)
        .send({ baseFee: 80 });

      // Then
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  describe('외섬 지역 CRUD', () => {
    it('縣 전체 규칙과 鄉 단위 규칙을 모두 등록할 수 있다', async () => {
      // When
      const wholeCounty = await adminRequest()
        .post('/remote-area')
        .send({ city: '澎湖縣' });
      const townshipOnly = await adminRequest()
        .post('/remote-area')
        .send({ city: '臺東縣', district: '綠島鄉' });

      // Then
      expect(wholeCounty.status).toBe(201);
      expect(townshipOnly.status).toBe(201);

      const listRes = await adminRequest().get('/remote-area');
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.total).toBe(2);

      const rows = listRes.body.data.list;
      const penghu = rows.find((r: any) => r.city === '澎湖縣');
      expect(penghu.district).toBeNull();
    });

    it('같은 지역을 두 번 등록하면 409를 반환한다', async () => {
      // Given
      await adminRequest().post('/remote-area').send({ city: '金門縣' });

      // When
      const res = await adminRequest()
        .post('/remote-area')
        .send({ city: '金門縣' });

      // Then
      expect(res.status).toBe(409);
    });

    it('縣 전체와 같은 縣의 鄉 규칙은 서로 다른 규칙으로 공존한다', async () => {
      // Given
      await adminRequest().post('/remote-area').send({ city: '臺東縣' });

      // When
      const res = await adminRequest()
        .post('/remote-area')
        .send({ city: '臺東縣', district: '蘭嶼鄉' });

      // Then
      expect(res.status).toBe(201);
    });

    it('삭제하면 목록에서 사라진다', async () => {
      // Given
      await adminRequest().post('/remote-area').send({ city: '連江縣' });
      const listRes = await adminRequest().get('/remote-area');
      const targetId = listRes.body.data.list[0].id;

      // When
      const res = await adminRequest().delete(`/remote-area/${targetId}`);

      // Then
      expect(res.status).toBe(204);

      const afterRes = await adminRequest().get('/remote-area');
      expect(afterRes.body.data.total).toBe(0);
    });

    it('없는 규칙을 삭제하면 404를 반환한다', async () => {
      // When
      const res = await adminRequest().delete('/remote-area/999999');

      // Then
      expect(res.status).toBe(404);
    });

    it('city가 비면 400을 반환한다', async () => {
      // When
      const res = await adminRequest().post('/remote-area').send({ city: '' });

      // Then
      expect(res.status).toBe(400);
    });
  });
});

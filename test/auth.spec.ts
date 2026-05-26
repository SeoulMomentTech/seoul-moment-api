import { CacheService } from '@app/cache/cache.service';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

const BASE_URL = '/auth';

describe('AuthController (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let cacheService: CacheService;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득 (최초 1회만 부트스트랩)
    app = await getTestApp();
    dataSource = getDataSource(app);
    cacheService = app.get(CacheService);
  }, 60_000);

  afterEach(async () => {
    await cacheService.deleteAll();
    await truncateTables(dataSource, ['"user"']);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  function buildPhone() {
    return `8210${faker.string.numeric(8)}`;
  }

  // -----------------------------------------------------------------------
  // POST /auth/email/verify
  // -----------------------------------------------------------------------
  describe('POST /auth/email/verify', () => {
    it('정상 코드로 검증하면 200을 반환하고 Redis의 코드는 1회 소비된다', async () => {
      // Given - Redis에 직접 코드 저장
      const email = faker.internet.email().toLowerCase();
      const code = 123456;
      await cacheService.set(email, code, 60 * 5);

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/email/verify`)
        .send({ email, code: code.toString() });

      // Then
      expect(res.status).toBe(200);
      const cached = await cacheService.find(email);
      expect(cached).toBeNull();
    });

    it('한 번 검증된 코드는 재사용할 수 없다', async () => {
      // Given
      const email = faker.internet.email().toLowerCase();
      const code = 123456;
      await cacheService.set(email, code, 60 * 5);

      // When - 첫 번째 검증 성공
      const first = await request(app.getHttpServer())
        .post(`${BASE_URL}/email/verify`)
        .send({ email, code: code.toString() });
      expect(first.status).toBe(200);

      // When - 동일 코드로 재검증
      const second = await request(app.getHttpServer())
        .post(`${BASE_URL}/email/verify`)
        .send({ email, code: code.toString() });

      // Then
      expect(second.status).toBe(401);
      expect(second.body.message).toBe('인증 코드가 만료되었습니다.');
    });

    it('코드가 일치하지 않으면 401을 반환하고 코드는 캐시에 그대로 남는다', async () => {
      // Given
      const email = faker.internet.email().toLowerCase();
      const code = 123456;
      await cacheService.set(email, code, 60 * 5);

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/email/verify`)
        .send({ email, code: '654321' });

      // Then
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('인증 코드가 일치하지 않습니다.');
      const cached = await cacheService.find(email);
      expect(cached).toBe(code.toString());
    });

    it('코드가 발송된 적 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/email/verify`)
        .send({ email: faker.internet.email().toLowerCase(), code: '123456' });

      // Then
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('인증 코드가 만료되었습니다.');
    });
  });

  // -----------------------------------------------------------------------
  // POST /auth/phone/verify
  // -----------------------------------------------------------------------
  describe('POST /auth/phone/verify', () => {
    it('정상 코드로 검증하면 200을 반환하고 Redis의 코드는 1회 소비된다', async () => {
      // Given
      const phone = buildPhone();
      const code = 123456;
      await cacheService.set(phone, code, 60 * 5);

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/phone/verify`)
        .send({ phone, code: code.toString() });

      // Then
      expect(res.status).toBe(200);
      const cached = await cacheService.find(phone);
      expect(cached).toBeNull();
    });

    it('한 번 검증된 코드는 재사용할 수 없다', async () => {
      // Given
      const phone = buildPhone();
      const code = 123456;
      await cacheService.set(phone, code, 60 * 5);

      // When - 첫 번째 검증 성공
      const first = await request(app.getHttpServer())
        .post(`${BASE_URL}/phone/verify`)
        .send({ phone, code: code.toString() });
      expect(first.status).toBe(200);

      // When - 동일 코드로 재검증
      const second = await request(app.getHttpServer())
        .post(`${BASE_URL}/phone/verify`)
        .send({ phone, code: code.toString() });

      // Then
      expect(second.status).toBe(401);
      expect(second.body.message).toBe('인증 코드가 만료되었습니다.');
    });

    it('코드가 일치하지 않으면 401을 반환하고 코드는 캐시에 그대로 남는다', async () => {
      // Given
      const phone = buildPhone();
      const code = 123456;
      await cacheService.set(phone, code, 60 * 5);

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/phone/verify`)
        .send({ phone, code: '654321' });

      // Then
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('인증 코드가 일치하지 않습니다.');
      const cached = await cacheService.find(phone);
      expect(cached).toBe(code.toString());
    });

    it('코드가 발송된 적 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/phone/verify`)
        .send({ phone: buildPhone(), code: '123456' });

      // Then
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('인증 코드가 만료되었습니다.');
    });

    it('code가 6자리 숫자가 아니면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/phone/verify`)
        .send({ phone: buildPhone(), code: 'abcdef' });

      // Then
      expect(res.status).toBe(400);
    });

    it('code가 6자리보다 짧으면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/phone/verify`)
        .send({ phone: buildPhone(), code: '12345' });

      // Then
      expect(res.status).toBe(400);
    });

    it('phone 필드가 누락되면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/phone/verify`)
        .send({ code: '123456' });

      // Then
      expect(res.status).toBe(400);
    });

    it('code 필드가 누락되면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/phone/verify`)
        .send({ phone: buildPhone() });

      // Then
      expect(res.status).toBe(400);
    });
  });
});

import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

const BASE_URL = '/user/auth';

const REFRESH_TOKEN_TYPE = 'REFRESH_TOKEN';
const ONE_TIME_TOKEN_TYPE = 'ONE_TIME_TIME';

function buildSignUpBody(overrides?: Record<string, unknown>) {
  return {
    email: faker.internet.email().toLowerCase(),
    password: faker.internet.password({ length: 12 }),
    phone: faker.string.numeric(11),
    personalInfoAgreeDate: '2025-01-01 12:00:00',
    ...overrides,
  };
}

describe('UserAuthController (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득 (최초 1회만 부트스트랩)
    app = await getTestApp();
    dataSource = getDataSource(app);
    jwtService = app.get(JwtService);
  }, 60_000);

  afterEach(async () => {
    await truncateTables(dataSource, [
      'user_brand_like',
      'user_product_like',
      'user_sns',
      'user_fit',
      'user_profile',
      '"user"',
    ]);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // -----------------------------------------------------------------------
  // POST /user/auth/signup
  // -----------------------------------------------------------------------
  describe('POST /user/auth/signup', () => {
    it('정상 가입 시 204를 반환하고 비밀번호는 bcrypt 해시로 저장된다', async () => {
      // Given
      const body = buildSignUpBody({ password: 'plain-password-1234' });

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(body);

      // Then
      expect(res.status).toBe(204);
      expect(res.body).toEqual({});

      const rows = await dataSource.query(
        `SELECT email, phone, password, refresh_token, personal_info_agree_date
         FROM "user" WHERE email = $1`,
        [body.email],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].password).not.toBe('plain-password-1234');
      expect(rows[0].password.startsWith('$2')).toBe(true);
      expect(rows[0].refresh_token).toBeNull();
      expect(rows[0].phone).toBe(body.phone);
      expect(rows[0].personal_info_agree_date).toBeInstanceOf(Date);
    });

    it('선택 동의 일시는 누락 시 null로 저장된다', async () => {
      // Given
      const body = buildSignUpBody();

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(body);

      // Then
      expect(res.status).toBe(204);
      const rows = await dataSource.query(
        `SELECT ad_agree_email_date, recommend_email_date, recommend_phone_date
         FROM "user" WHERE email = $1`,
        [body.email],
      );
      expect(rows[0].ad_agree_email_date).toBeNull();
      expect(rows[0].recommend_email_date).toBeNull();
      expect(rows[0].recommend_phone_date).toBeNull();
    });

    it('선택 동의 일시 문자열이 Date로 변환되어 저장된다', async () => {
      // Given
      const body = buildSignUpBody({
        adAgreeEmailDate: '2025-02-03 04:05:06',
        recommendEmailDate: '2025-03-04 05:06:07',
        recommendPhoneDate: '2025-04-05 06:07:08',
      });

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(body);

      // Then
      expect(res.status).toBe(204);
      const rows = await dataSource.query(
        `SELECT ad_agree_email_date, recommend_email_date, recommend_phone_date
         FROM "user" WHERE email = $1`,
        [body.email],
      );
      expect(rows[0].ad_agree_email_date).toBeInstanceOf(Date);
      expect(rows[0].recommend_email_date).toBeInstanceOf(Date);
      expect(rows[0].recommend_phone_date).toBeInstanceOf(Date);
    });

    it('이메일 형식이 잘못되면 400을 반환한다', async () => {
      // Given
      const body = buildSignUpBody({ email: 'not-an-email' });

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(body);

      // Then
      expect(res.status).toBe(400);
    });

    it('필수 필드(phone)가 누락되면 400을 반환한다', async () => {
      // Given
      const body = buildSignUpBody();
      delete (body as Record<string, unknown>).phone;

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(body);

      // Then
      expect(res.status).toBe(400);
    });

    it('personalInfoAgreeDate가 잘못된 날짜 형식이면 400을 반환한다', async () => {
      // Given
      const body = buildSignUpBody({ personalInfoAgreeDate: 'not-a-date' });

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(body);

      // Then
      expect(res.status).toBe(400);
    });

    it('선택 동의 일시가 잘못된 날짜 형식이면 400을 반환한다', async () => {
      // Given
      const body = buildSignUpBody({ adAgreeEmailDate: 'oops' });

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(body);

      // Then
      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // POST /user/auth/login
  // -----------------------------------------------------------------------
  describe('POST /user/auth/login', () => {
    async function signUp(overrides?: Record<string, unknown>) {
      const body = buildSignUpBody(overrides);
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(body);
      expect(res.status).toBe(204);
      return body;
    }

    it('정상 로그인 시 token과 refreshToken을 반환하고 DB에 refresh_token이 저장된다', async () => {
      // Given
      const credentials = await signUp();

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/login`)
        .send({
          email: credentials.email,
          password: credentials.password,
        });

      // Then
      expect(res.status).toBe(200);
      expect(res.body.result).toBe(true);
      expect(typeof res.body.data.token).toBe('string');
      expect(typeof res.body.data.refreshToken).toBe('string');
      expect(res.body.data.token).not.toBe(res.body.data.refreshToken);

      const rows = await dataSource.query(
        `SELECT refresh_token FROM "user" WHERE email = $1`,
        [credentials.email],
      );
      expect(rows[0].refresh_token).toBe(res.body.data.refreshToken);

      // 토큰 페이로드 검증
      const tokenPayload = jwtService.decode(res.body.data.token) as {
        jwtType: string;
      } | null;
      expect(tokenPayload).not.toBeNull();
      expect(tokenPayload.jwtType).toBe(ONE_TIME_TOKEN_TYPE);
      const refreshPayload = jwtService.decode(res.body.data.refreshToken) as {
        jwtType: string;
      } | null;
      expect(refreshPayload).not.toBeNull();
      expect(refreshPayload.jwtType).toBe(REFRESH_TOKEN_TYPE);
    });

    it('미가입 이메일이면 401과 Invalid credentials를 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/login`)
        .send({
          email: 'nobody@nowhere.com',
          password: 'whatever-1234',
        });

      // Then
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid credentials');
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('비밀번호가 일치하지 않으면 401과 Invalid credentials를 반환한다 (이메일 enumeration 방지)', async () => {
      // Given
      const credentials = await signUp();

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/login`)
        .send({
          email: credentials.email,
          password: 'wrong-password',
        });

      // Then
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid credentials');
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('이메일 형식이 잘못되면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/login`)
        .send({
          email: 'not-an-email',
          password: 'whatever-1234',
        });

      // Then
      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // GET /user/auth/one-time-token
  // -----------------------------------------------------------------------
  describe('GET /user/auth/one-time-token', () => {
    async function signUpAndLogin() {
      const body = buildSignUpBody();
      await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(body);
      const loginRes = await request(app.getHttpServer())
        .post(`${BASE_URL}/login`)
        .send({ email: body.email, password: body.password });
      return {
        email: body.email,
        token: loginRes.body.data.token as string,
        refreshToken: loginRes.body.data.refreshToken as string,
      };
    }

    it('유효한 refreshToken으로 oneTimeToken을 발급받는다', async () => {
      // Given
      const { refreshToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .get(`${BASE_URL}/one-time-token`)
        .set('Authorization', `Bearer ${refreshToken}`);

      // Then
      expect(res.status).toBe(200);
      expect(typeof res.body.data.oneTimeToken).toBe('string');
      const payload = jwtService.decode(res.body.data.oneTimeToken) as {
        jwtType: string;
      } | null;
      expect(payload).not.toBeNull();
      expect(payload.jwtType).toBe(ONE_TIME_TOKEN_TYPE);
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).get(
        `${BASE_URL}/one-time-token`,
      );

      // Then
      expect(res.status).toBe(401);
    });

    it('access token(jwtType이 다름)으로 호출하면 403을 반환한다', async () => {
      // Given
      const { token } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .get(`${BASE_URL}/one-time-token`)
        .set('Authorization', `Bearer ${token}`);

      // Then
      expect(res.status).toBe(403);
    });

    it('만료된 refreshToken이면 401을 반환한다', async () => {
      // Given - signup 후 만료된 refreshToken을 직접 서명
      const body = buildSignUpBody();
      await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(body);
      const userRow = await dataSource.query(
        `SELECT id FROM "user" WHERE email = $1`,
        [body.email],
      );
      const expiredToken = await jwtService.signAsync(
        { id: userRow[0].id, jwtType: REFRESH_TOKEN_TYPE },
        { expiresIn: '-1s' },
      );

      // When
      const res = await request(app.getHttpServer())
        .get(`${BASE_URL}/one-time-token`)
        .set('Authorization', `Bearer ${expiredToken}`);

      // Then
      expect(res.status).toBe(401);
    });

    it('DB의 refresh_token과 다른 토큰이면 403을 반환한다', async () => {
      // Given - 로그인 후 DB의 refresh_token을 다른 값으로 변경
      const { email, refreshToken } = await signUpAndLogin();
      await dataSource.query(
        `UPDATE "user" SET refresh_token = 'tampered-value' WHERE email = $1`,
        [email],
      );

      // When
      const res = await request(app.getHttpServer())
        .get(`${BASE_URL}/one-time-token`)
        .set('Authorization', `Bearer ${refreshToken}`);

      // Then
      expect(res.status).toBe(403);
    });

    it('DB의 refresh_token이 null이면 403을 반환한다', async () => {
      // Given
      const { email, refreshToken } = await signUpAndLogin();
      await dataSource.query(
        `UPDATE "user" SET refresh_token = NULL WHERE email = $1`,
        [email],
      );

      // When
      const res = await request(app.getHttpServer())
        .get(`${BASE_URL}/one-time-token`)
        .set('Authorization', `Bearer ${refreshToken}`);

      // Then
      expect(res.status).toBe(403);
    });

    it('서명이 변조된 토큰이면 401을 반환한다', async () => {
      // Given - 마지막 문자를 바꿔 서명을 변조
      const { refreshToken } = await signUpAndLogin();
      const tampered = `${refreshToken.slice(0, -1)}${
        refreshToken.slice(-1) === 'A' ? 'B' : 'A'
      }`;

      // When
      const res = await request(app.getHttpServer())
        .get(`${BASE_URL}/one-time-token`)
        .set('Authorization', `Bearer ${tampered}`);

      // Then
      expect(res.status).toBe(401);
    });
  });
});

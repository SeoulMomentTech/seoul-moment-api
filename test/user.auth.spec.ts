import { CacheService } from '@app/cache/cache.service';
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
  let cacheService: CacheService;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득 (최초 1회만 부트스트랩)
    app = await getTestApp();
    dataSource = getDataSource(app);
    jwtService = app.get(JwtService);
    cacheService = app.get(CacheService);
  }, 60_000);

  afterEach(async () => {
    await cacheService.deleteAll();
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

    it('phone이 누락되어도 가입에 성공하고 DB에는 null로 저장된다', async () => {
      // Given - phone이 빠진 가입 요청
      const body = buildSignUpBody();
      delete (body as Record<string, unknown>).phone;

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(body);

      // Then
      expect(res.status).toBe(204);
      const rows = await dataSource.query(
        `SELECT phone FROM "user" WHERE email = $1`,
        [body.email],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].phone).toBeNull();
    });

    it('phone이 string이 아니면 400을 반환한다', async () => {
      // Given - phone에 숫자형 값을 넣어 IsString 검증을 트리거
      const body = buildSignUpBody({ phone: 12345678901 });

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(body);

      // Then
      expect(res.status).toBe(400);
    });

    it('phone을 NULL로 둔 사용자는 여러 명 존재할 수 있다', async () => {
      // Given - phone이 빠진 두 개의 가입 요청
      const first = buildSignUpBody();
      const second = buildSignUpBody();
      delete (first as Record<string, unknown>).phone;
      delete (second as Record<string, unknown>).phone;

      // When
      const firstRes = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(first);
      const secondRes = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(second);

      // Then - NULL은 unique 제약에서 서로 다른 값으로 취급되어 둘 다 가입 가능
      expect(firstRes.status).toBe(204);
      expect(secondRes.status).toBe(204);
      const rows = await dataSource.query(
        `SELECT phone FROM "user" WHERE email IN ($1, $2)`,
        [first.email, second.email],
      );
      expect(rows).toHaveLength(2);
      expect(
        rows.every((r: { phone: string | null }) => r.phone === null),
      ).toBe(true);
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
      const tokenPayload = jwtService.decode(res.body.data.token);
      expect(tokenPayload).not.toBeNull();
      expect(tokenPayload.jwtType).toBe(ONE_TIME_TOKEN_TYPE);
      const refreshPayload = jwtService.decode(res.body.data.refreshToken);
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
      await request(app.getHttpServer()).post(`${BASE_URL}/signup`).send(body);
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
      const payload = jwtService.decode(res.body.data.oneTimeToken);
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
      await request(app.getHttpServer()).post(`${BASE_URL}/signup`).send(body);
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

  // -----------------------------------------------------------------------
  // POST /user/auth/email/code
  // -----------------------------------------------------------------------
  describe('POST /user/auth/email/code', () => {
    it('미가입 이메일로 요청하면 200을 반환하고 Redis에 6자리 인증 코드가 저장된다', async () => {
      // Given
      const email = faker.internet.email().toLowerCase();

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/email/code`)
        .send({ email });

      // Then
      expect(res.status).toBe(200);
      const cached = await cacheService.find(email);
      expect(cached).not.toBeNull();
      expect(cached).toMatch(/^\d{6}$/);
    });

    it('이미 가입된 이메일이면 409와 User already exists를 반환한다', async () => {
      // Given - signup으로 사용자 생성
      const body = buildSignUpBody();
      const signupRes = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(body);
      expect(signupRes.status).toBe(204);

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/email/code`)
        .send({ email: body.email });

      // Then
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('User already exists');

      // Redis에 인증 코드가 저장되지 않아야 한다
      const cached = await cacheService.find(body.email);
      expect(cached).toBeNull();
    });

    it('이메일 형식이 잘못되면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/email/code`)
        .send({ email: 'not-an-email' });

      // Then
      expect(res.status).toBe(400);
    });

    it('email 필드가 누락되면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/email/code`)
        .send({});

      // Then
      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // POST /user/auth/password/email/code
  // -----------------------------------------------------------------------
  describe('POST /user/auth/password/email/code', () => {
    it('가입된 이메일로 요청하면 200을 반환하고 Redis에 6자리 인증 코드가 저장된다', async () => {
      // Given - signup으로 사용자 생성
      const body = buildSignUpBody();
      await request(app.getHttpServer()).post(`${BASE_URL}/signup`).send(body);

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/password/email/code`)
        .send({ email: body.email });

      // Then
      expect(res.status).toBe(200);
      const cached = await cacheService.find(body.email);
      expect(cached).not.toBeNull();
      expect(cached).toMatch(/^\d{6}$/);
    });

    it('미가입 이메일이면 404와 User not found를 반환하고 Redis에 코드가 저장되지 않는다', async () => {
      // Given
      const email = faker.internet.email().toLowerCase();

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/password/email/code`)
        .send({ email });

      // Then
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('User not found');
      const cached = await cacheService.find(email);
      expect(cached).toBeNull();
    });

    it('이메일 형식이 잘못되면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/password/email/code`)
        .send({ email: 'not-an-email' });

      // Then
      expect(res.status).toBe(400);
    });

    it('email 필드가 누락되면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/password/email/code`)
        .send({});

      // Then
      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // POST /user/auth/password/email/verify
  // -----------------------------------------------------------------------
  describe('POST /user/auth/password/email/verify', () => {
    async function signUpAndRequestCode() {
      const body = buildSignUpBody();
      await request(app.getHttpServer()).post(`${BASE_URL}/signup`).send(body);
      const codeRes = await request(app.getHttpServer())
        .post(`${BASE_URL}/password/email/code`)
        .send({ email: body.email });
      expect(codeRes.status).toBe(200);
      const code = await cacheService.find(body.email);
      expect(code).not.toBeNull();
      return { email: body.email, code };
    }

    it('정상 코드로 검증하면 200과 비밀번호 재설정용 one time token을 반환한다', async () => {
      // Given
      const { email, code } = await signUpAndRequestCode();

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/password/email/verify`)
        .send({ email, code });

      // Then
      expect(res.status).toBe(200);
      expect(res.body.result).toBe(true);
      expect(typeof res.body.data.token).toBe('string');
      const payload = jwtService.decode(res.body.data.token);
      expect(payload).not.toBeNull();
      expect(payload.jwtType).toBe(ONE_TIME_TOKEN_TYPE);

      // 토큰의 id가 실제 가입된 사용자 id와 일치해야 한다
      const userRow = await dataSource.query(
        `SELECT id FROM "user" WHERE email = $1`,
        [email],
      );
      expect(payload.id).toBe(userRow[0].id);
    });

    it('코드가 일치하지 않으면 401과 인증 코드 불일치 메시지를 반환한다', async () => {
      // Given
      const { email, code } = await signUpAndRequestCode();
      const wrongCode = ((parseInt(code, 10) + 1) % 1000000)
        .toString()
        .padStart(6, '0');

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/password/email/verify`)
        .send({ email, code: wrongCode });

      // Then
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('인증 코드가 일치하지 않습니다.');
    });

    it('코드가 만료되었거나 발송된 적 없으면 401을 반환한다', async () => {
      // Given - 가입은 했지만 코드 발송 안 함
      const body = buildSignUpBody();
      await request(app.getHttpServer()).post(`${BASE_URL}/signup`).send(body);

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/password/email/verify`)
        .send({ email: body.email, code: '123456' });

      // Then
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('인증 코드가 만료되었습니다.');
    });

    it('이메일 형식이 잘못되면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/password/email/verify`)
        .send({ email: 'not-an-email', code: '123456' });

      // Then
      expect(res.status).toBe(400);
    });

    it('code 필드가 누락되면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/password/email/verify`)
        .send({ email: 'foo@bar.com' });

      // Then
      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // PATCH /user/auth/password
  // -----------------------------------------------------------------------
  describe('PATCH /user/auth/password', () => {
    async function signUpAndIssueResetToken() {
      const body = buildSignUpBody();
      await request(app.getHttpServer()).post(`${BASE_URL}/signup`).send(body);
      await request(app.getHttpServer())
        .post(`${BASE_URL}/password/email/code`)
        .send({ email: body.email });
      const code = await cacheService.find(body.email);
      const verifyRes = await request(app.getHttpServer())
        .post(`${BASE_URL}/password/email/verify`)
        .send({ email: body.email, code });
      expect(verifyRes.status).toBe(200);
      return {
        email: body.email,
        oldPassword: body.password,
        token: verifyRes.body.data.token as string,
      };
    }

    it('one time token으로 비밀번호를 변경하면 204를 반환하고 새 비밀번호로 로그인할 수 있다', async () => {
      // Given
      const { email, oldPassword, token } = await signUpAndIssueResetToken();
      const newPassword = 'brand-new-password-1234';

      const beforeRow = await dataSource.query(
        `SELECT password FROM "user" WHERE email = $1`,
        [email],
      );

      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/password`)
        .set('Authorization', `Bearer ${token}`)
        .send({ password: newPassword });

      // Then
      expect(res.status).toBe(204);
      expect(res.body).toEqual({});

      const afterRow = await dataSource.query(
        `SELECT password FROM "user" WHERE email = $1`,
        [email],
      );
      expect(afterRow[0].password).not.toBe(beforeRow[0].password);
      expect(afterRow[0].password.startsWith('$2')).toBe(true);

      // 기존 비밀번호로는 로그인 실패
      const oldLoginRes = await request(app.getHttpServer())
        .post(`${BASE_URL}/login`)
        .send({ email, password: oldPassword });
      expect(oldLoginRes.status).toBe(401);

      // 새 비밀번호로는 로그인 성공
      const newLoginRes = await request(app.getHttpServer())
        .post(`${BASE_URL}/login`)
        .send({ email, password: newPassword });
      expect(newLoginRes.status).toBe(200);
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/password`)
        .send({ password: 'whatever-1234' });

      // Then
      expect(res.status).toBe(401);
    });

    it('refresh token(jwtType이 다름)으로 호출하면 401을 반환한다', async () => {
      // Given - signup → login으로 refreshToken 획득
      const body = buildSignUpBody();
      await request(app.getHttpServer()).post(`${BASE_URL}/signup`).send(body);
      const loginRes = await request(app.getHttpServer())
        .post(`${BASE_URL}/login`)
        .send({ email: body.email, password: body.password });
      const refreshToken = loginRes.body.data.refreshToken as string;

      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/password`)
        .set('Authorization', `Bearer ${refreshToken}`)
        .send({ password: 'whatever-1234' });

      // Then
      expect(res.status).toBe(401);
    });

    it('만료된 token이면 401을 반환한다', async () => {
      // Given - signup 후 만료된 ONE_TIME_TOKEN을 직접 서명
      const body = buildSignUpBody();
      await request(app.getHttpServer()).post(`${BASE_URL}/signup`).send(body);
      const userRow = await dataSource.query(
        `SELECT id FROM "user" WHERE email = $1`,
        [body.email],
      );
      const expiredToken = await jwtService.signAsync(
        { id: userRow[0].id, jwtType: ONE_TIME_TOKEN_TYPE },
        { expiresIn: '-1s' },
      );

      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/password`)
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ password: 'whatever-1234' });

      // Then
      expect(res.status).toBe(401);
    });

    it('서명이 변조된 token이면 401을 반환한다', async () => {
      // Given
      const { token } = await signUpAndIssueResetToken();
      const tampered = `${token.slice(0, -1)}${
        token.slice(-1) === 'A' ? 'B' : 'A'
      }`;

      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/password`)
        .set('Authorization', `Bearer ${tampered}`)
        .send({ password: 'whatever-1234' });

      // Then
      expect(res.status).toBe(401);
    });

    it('password 필드가 누락되면 400을 반환한다', async () => {
      // Given
      const { token } = await signUpAndIssueResetToken();

      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/password`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      // Then
      expect(res.status).toBe(400);
    });

    it('email 필드가 추가되면 forbidNonWhitelisted 검증으로 400을 반환한다', async () => {
      // Given
      const { token } = await signUpAndIssueResetToken();

      // When
      const res = await request(app.getHttpServer())
        .patch(`${BASE_URL}/password`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'extra@test.com', password: 'whatever-1234' });

      // Then - DTO에 email이 없으므로 whitelist에 의해 거부됨
      expect(res.status).toBe(400);
    });
  });
});

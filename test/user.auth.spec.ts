import { CacheService } from '@app/cache/cache.service';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Configuration } from '@app/config/configuration';
import { ExternalGoogleAuthService } from '@app/external/google/google-auth.service';
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
const SNS_LINK_TOKEN_TYPE = 'SNS_LINK_TOKEN';
const SNS_SIGNUP_TOKEN_TYPE = 'SNS_SIGNUP_TOKEN';

function buildSignUpBody(overrides?: Record<string, unknown>) {
  return {
    email: faker.internet.email().toLowerCase(),
    password: faker.internet.password({ length: 12 }),
    nickname: faker.internet
      .username()
      .replace(/[^a-zA-Z0-9_]/g, '')
      .slice(0, 20),
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
        `SELECT email, nickname, password, refresh_token,
                terms_of_service_agree_date, privacy_policy_agree_date
         FROM "user" WHERE email = $1`,
        [body.email],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].password).not.toBe('plain-password-1234');
      expect(rows[0].password.startsWith('$2')).toBe(true);
      expect(rows[0].refresh_token).toBeNull();
      expect(rows[0].nickname).toBe(body.nickname);
      // 약관/개인정보 동의 일시는 DB DEFAULT NOW()로 자동 기록
      expect(rows[0].terms_of_service_agree_date).toBeInstanceOf(Date);
      expect(rows[0].privacy_policy_agree_date).toBeInstanceOf(Date);
    });

    it('선택 동의 boolean이 누락되면 해당 일시 컬럼은 null로 저장된다', async () => {
      // Given
      const body = buildSignUpBody();

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(body);

      // Then
      expect(res.status).toBe(204);
      const rows = await dataSource.query(
        `SELECT new_product_date, ad_agree_date, recommend_date
         FROM "user" WHERE email = $1`,
        [body.email],
      );
      expect(rows[0].new_product_date).toBeNull();
      expect(rows[0].ad_agree_date).toBeNull();
      expect(rows[0].recommend_date).toBeNull();
    });

    it('선택 동의 boolean이 true면 해당 일시 컬럼이 Date로 채워진다', async () => {
      // Given
      const body = buildSignUpBody({
        newProductAgreed: true,
        adAgreed: true,
        recommendAgreed: true,
      });

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(body);

      // Then
      expect(res.status).toBe(204);
      const rows = await dataSource.query(
        `SELECT new_product_date, ad_agree_date, recommend_date
         FROM "user" WHERE email = $1`,
        [body.email],
      );
      expect(rows[0].new_product_date).toBeInstanceOf(Date);
      expect(rows[0].ad_agree_date).toBeInstanceOf(Date);
      expect(rows[0].recommend_date).toBeInstanceOf(Date);
    });

    it('선택 동의 boolean이 false면 해당 일시 컬럼은 null로 저장된다', async () => {
      // Given
      const body = buildSignUpBody({
        newProductAgreed: false,
        adAgreed: false,
        recommendAgreed: false,
      });

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(body);

      // Then
      expect(res.status).toBe(204);
      const rows = await dataSource.query(
        `SELECT new_product_date, ad_agree_date, recommend_date
         FROM "user" WHERE email = $1`,
        [body.email],
      );
      expect(rows[0].new_product_date).toBeNull();
      expect(rows[0].ad_agree_date).toBeNull();
      expect(rows[0].recommend_date).toBeNull();
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

    it('nickname이 누락되면 400을 반환한다', async () => {
      // Given
      const body = buildSignUpBody();
      delete (body as Record<string, unknown>).nickname;

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(body);

      // Then
      expect(res.status).toBe(400);
    });

    it('이미 가입된 nickname으로 가입 시 409와 nickname 중복 메시지를 반환한다', async () => {
      // Given - 첫 사용자 가입
      const first = buildSignUpBody();
      const firstRes = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(first);
      expect(firstRes.status).toBe(204);

      // When - 동일 nickname으로 두 번째 가입 시도
      const second = buildSignUpBody({ nickname: first.nickname });
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(second);

      // Then
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('User nickname already exists');
      const rows = await dataSource.query(
        `SELECT email FROM "user" WHERE nickname = $1`,
        [first.nickname],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].email).toBe(first.email);
    });

    it('선택 동의 필드가 boolean이 아니면 400을 반환한다', async () => {
      // Given
      const body = buildSignUpBody({ newProductAgreed: 'yes' });

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(body);

      // Then
      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // POST /user/auth/nickname/validate
  // -----------------------------------------------------------------------
  describe('POST /user/auth/nickname/validate', () => {
    it('미사용 nickname이면 200을 반환한다', async () => {
      // Given
      const nickname = faker.internet
        .username()
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 20);

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/nickname/validate`)
        .send({ nickname });

      // Then
      expect(res.status).toBe(200);
    });

    it('이미 가입된 nickname이면 409와 nickname 중복 메시지를 반환한다', async () => {
      // Given - 사용자 가입
      const body = buildSignUpBody();
      const signupRes = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(body);
      expect(signupRes.status).toBe(204);

      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/nickname/validate`)
        .send({ nickname: body.nickname });

      // Then
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('User nickname already exists');
    });

    it('nickname 필드가 누락되면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/nickname/validate`)
        .send({});

      // Then
      expect(res.status).toBe(400);
    });

    it('nickname이 문자열이 아니면 400을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/nickname/validate`)
        .send({ nickname: 12345 });

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

  // -----------------------------------------------------------------------
  // Google 인증 (POST /user/auth/google/login | link | signup)
  // -----------------------------------------------------------------------
  describe('Google 인증', () => {
    let googleAuthService: ExternalGoogleAuthService;
    let tokenSigner: JwtService;

    beforeAll(() => {
      // Given - 외부 Google idToken 검증 서비스 + user.auth와 동일 시크릿 서명기
      googleAuthService = app.get(ExternalGoogleAuthService, {
        strict: false,
      });
      tokenSigner = new JwtService({
        secret: Configuration.getConfig().JWT_SECRET,
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    function mockVerifyIdToken(payload: {
      providerUserId: string;
      email: string;
      emailVerified: boolean;
    }) {
      jest.spyOn(googleAuthService, 'verifyIdToken').mockResolvedValue(payload);
    }

    function buildNickname() {
      return faker.internet
        .username()
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 20);
    }

    async function signUpUser() {
      const body = buildSignUpBody();
      const res = await request(app.getHttpServer())
        .post(`${BASE_URL}/signup`)
        .send(body);
      expect(res.status).toBe(204);
      const rows = await dataSource.query(
        `SELECT id FROM "user" WHERE email = $1`,
        [body.email],
      );
      return { ...body, id: rows[0].id as number };
    }

    describe('POST /user/auth/google/login', () => {
      it('미가입 + 미연결 계정이면 needsSignup과 signupToken을 반환한다', async () => {
        // Given
        const providerUserId = faker.string.numeric(21);
        const email = faker.internet.email().toLowerCase();
        mockVerifyIdToken({ providerUserId, email, emailVerified: true });

        // When
        const res = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/login`)
          .send({ idToken: 'fake-id-token' });

        // Then
        expect(res.status).toBe(200);
        expect(res.body.data.needsLinkConfirm).toBe(false);
        expect(res.body.data.needsSignup).toBe(true);
        expect(res.body.data.email).toBe(email);
        const payload = jwtService.decode(res.body.data.signupToken);
        expect(payload.jwtType).toBe(SNS_SIGNUP_TOKEN_TYPE);
        expect(payload.providerUserId).toBe(providerUserId);
        expect(res.body.data.token).toBeUndefined();
      });

      it('기존 이메일 가입자가 미연결이면 needsLinkConfirm과 linkToken을 반환한다', async () => {
        // Given
        const user = await signUpUser();
        const providerUserId = faker.string.numeric(21);
        mockVerifyIdToken({
          providerUserId,
          email: user.email,
          emailVerified: true,
        });

        // When
        const res = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/login`)
          .send({ idToken: 'fake-id-token' });

        // Then
        expect(res.status).toBe(200);
        expect(res.body.data.needsLinkConfirm).toBe(true);
        expect(res.body.data.email).toBe(user.email);
        const payload = jwtService.decode(res.body.data.linkToken);
        expect(payload.jwtType).toBe(SNS_LINK_TOKEN_TYPE);
        expect(payload.userId).toBe(user.id);
      });

      it('이미 연결된 Google 계정이면 바로 로그인 토큰을 반환한다', async () => {
        // Given - 가입 후 link까지 완료해 user_sns 연결 생성
        const user = await signUpUser();
        const providerUserId = faker.string.numeric(21);
        mockVerifyIdToken({
          providerUserId,
          email: user.email,
          emailVerified: true,
        });
        const loginRes = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/login`)
          .send({ idToken: 'fake-id-token' });
        await request(app.getHttpServer())
          .post(`${BASE_URL}/google/link`)
          .send({ linkToken: loginRes.body.data.linkToken })
          .expect(200);

        // When - 동일 providerUserId로 재로그인
        const res = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/login`)
          .send({ idToken: 'fake-id-token' });

        // Then
        expect(res.status).toBe(200);
        expect(res.body.data.needsLinkConfirm).toBe(false);
        expect(typeof res.body.data.token).toBe('string');
        expect(typeof res.body.data.refreshToken).toBe('string');
        const rows = await dataSource.query(
          `SELECT refresh_token FROM "user" WHERE id = $1`,
          [user.id],
        );
        expect(rows[0].refresh_token).toBe(res.body.data.refreshToken);
      });

      it('Google 이메일이 미인증이면 401을 반환한다', async () => {
        // Given
        mockVerifyIdToken({
          providerUserId: faker.string.numeric(21),
          email: faker.internet.email().toLowerCase(),
          emailVerified: false,
        });

        // When
        const res = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/login`)
          .send({ idToken: 'fake-id-token' });

        // Then
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('UNAUTHORIZED');
      });

      it('유효하지 않은 idToken이면 401을 반환한다', async () => {
        // Given
        jest
          .spyOn(googleAuthService, 'verifyIdToken')
          .mockRejectedValue(
            new ServiceError(
              '유효하지 않은 Google idToken입니다.',
              ServiceErrorCode.UNAUTHORIZED,
            ),
          );

        // When
        const res = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/login`)
          .send({ idToken: 'bad-token' });

        // Then
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('UNAUTHORIZED');
      });

      it('idToken이 누락되면 400을 반환한다', async () => {
        // When
        const res = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/login`)
          .send({});

        // Then
        expect(res.status).toBe(400);
      });
    });

    describe('POST /user/auth/google/link', () => {
      it('linkToken으로 연결하면 토큰을 발급하고 user_sns 행이 생성된다', async () => {
        // Given
        const user = await signUpUser();
        const providerUserId = faker.string.numeric(21);
        mockVerifyIdToken({
          providerUserId,
          email: user.email,
          emailVerified: true,
        });
        const loginRes = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/login`)
          .send({ idToken: 'fake-id-token' });

        // When
        const res = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/link`)
          .send({ linkToken: loginRes.body.data.linkToken });

        // Then
        expect(res.status).toBe(200);
        expect(typeof res.body.data.token).toBe('string');
        expect(typeof res.body.data.refreshToken).toBe('string');
        const sns = await dataSource.query(
          `SELECT user_id, provider, provider_user_id, provider_email
           FROM user_sns WHERE user_id = $1`,
          [user.id],
        );
        expect(sns).toHaveLength(1);
        expect(sns[0].provider).toBe('GOOGLE');
        expect(sns[0].provider_user_id).toBe(providerUserId);
      });

      it('이미 다른 계정에 연결된 Google 계정이면 409를 반환한다', async () => {
        // Given - userA에 providerUserId P 연결
        const userA = await signUpUser();
        const providerUserId = faker.string.numeric(21);
        mockVerifyIdToken({
          providerUserId,
          email: userA.email,
          emailVerified: true,
        });
        const loginRes = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/login`)
          .send({ idToken: 'fake-id-token' });
        await request(app.getHttpServer())
          .post(`${BASE_URL}/google/link`)
          .send({ linkToken: loginRes.body.data.linkToken })
          .expect(200);

        // Given - userB 명의의 linkToken을 동일 providerUserId로 위조
        const userB = await signUpUser();
        const forgedLinkToken = tokenSigner.sign(
          {
            userId: userB.id,
            providerUserId,
            providerEmail: userB.email,
            email: userB.email,
            provider: 'GOOGLE',
            jwtType: SNS_LINK_TOKEN_TYPE,
          },
          { expiresIn: '5m' },
        );

        // When
        const res = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/link`)
          .send({ linkToken: forgedLinkToken });

        // Then
        expect(res.status).toBe(409);
        expect(res.body.message).toBe(
          '이미 다른 계정에 연결된 Google 계정입니다.',
        );
      });

      it('해당 계정이 이미 다른 Google 계정에 연결돼 있으면 409를 반환하고 기존 연결을 덮어쓰지 않는다', async () => {
        // Given - user에 P1 연결
        const user = await signUpUser();
        const providerUserId1 = faker.string.numeric(21);
        mockVerifyIdToken({
          providerUserId: providerUserId1,
          email: user.email,
          emailVerified: true,
        });
        const loginRes1 = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/login`)
          .send({ idToken: 'fake-id-token' });
        await request(app.getHttpServer())
          .post(`${BASE_URL}/google/link`)
          .send({ linkToken: loginRes1.body.data.linkToken })
          .expect(200);

        // Given - 같은 user에 새 providerUserId P2 linkToken 발급
        const providerUserId2 = faker.string.numeric(21);
        mockVerifyIdToken({
          providerUserId: providerUserId2,
          email: user.email,
          emailVerified: true,
        });
        const loginRes2 = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/login`)
          .send({ idToken: 'fake-id-token' });

        // When - P2로 link 시도
        const res = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/link`)
          .send({ linkToken: loginRes2.body.data.linkToken });

        // Then - 409 & 기존 P1 연결이 그대로 유지됨
        expect(res.status).toBe(409);
        expect(res.body.message).toBe(
          '이미 다른 Google 계정이 연결된 계정입니다.',
        );
        const sns = await dataSource.query(
          `SELECT provider_user_id FROM user_sns WHERE user_id = $1`,
          [user.id],
        );
        expect(sns).toHaveLength(1);
        expect(sns[0].provider_user_id).toBe(providerUserId1);
      });

      it('jwtType이 link 토큰이 아니면 401을 반환한다', async () => {
        // Given - refresh 타입 토큰을 linkToken 자리에 전달
        const wrongToken = tokenSigner.sign(
          {
            userId: 1,
            providerUserId: faker.string.numeric(21),
            jwtType: REFRESH_TOKEN_TYPE,
          },
          { expiresIn: '5m' },
        );

        // When
        const res = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/link`)
          .send({ linkToken: wrongToken });

        // Then
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('유효하지 않은 link token입니다.');
      });

      it('linkToken이 누락되면 400을 반환한다', async () => {
        // When
        const res = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/link`)
          .send({});

        // Then
        expect(res.status).toBe(400);
      });
    });

    describe('POST /user/auth/google/signup', () => {
      function buildSignupToken(overrides?: Record<string, unknown>) {
        return tokenSigner.sign(
          {
            providerUserId: faker.string.numeric(21),
            providerEmail: faker.internet.email().toLowerCase(),
            email: faker.internet.email().toLowerCase(),
            provider: 'GOOGLE',
            jwtType: SNS_SIGNUP_TOKEN_TYPE,
            ...overrides,
          },
          { expiresIn: '10m' },
        );
      }

      it('signupToken과 nickname으로 신규 user와 user_sns를 생성한다', async () => {
        // Given
        const email = faker.internet.email().toLowerCase();
        const providerUserId = faker.string.numeric(21);
        const signupToken = buildSignupToken({
          email,
          providerEmail: email,
          providerUserId,
        });
        const nickname = buildNickname();

        // When
        const res = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/signup`)
          .send({ signupToken, nickname });

        // Then
        expect(res.status).toBe(200);
        expect(typeof res.body.data.token).toBe('string');
        expect(typeof res.body.data.refreshToken).toBe('string');
        const users = await dataSource.query(
          `SELECT id, nickname, password FROM "user" WHERE email = $1`,
          [email],
        );
        expect(users).toHaveLength(1);
        expect(users[0].nickname).toBe(nickname);
        // SNS 가입자는 사용 불가한 임의 bcrypt 해시가 채워진다
        expect(users[0].password.startsWith('$2')).toBe(true);
        const sns = await dataSource.query(
          `SELECT provider, provider_user_id FROM user_sns WHERE user_id = $1`,
          [users[0].id],
        );
        expect(sns).toHaveLength(1);
        expect(sns[0].provider_user_id).toBe(providerUserId);
      });

      it('이미 가입된 nickname이면 409를 반환한다', async () => {
        // Given
        const existing = await signUpUser();
        const signupToken = buildSignupToken();

        // When
        const res = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/signup`)
          .send({ signupToken, nickname: existing.nickname });

        // Then
        expect(res.status).toBe(409);
      });

      it('createUserSns 단계에서 충돌이 나면 트랜잭션이 롤백되어 user가 생성되지 않는다', async () => {
        // Given - userA에 providerUserId P 연결
        const userA = await signUpUser();
        const providerUserId = faker.string.numeric(21);
        mockVerifyIdToken({
          providerUserId,
          email: userA.email,
          emailVerified: true,
        });
        const loginRes = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/login`)
          .send({ idToken: 'fake-id-token' });
        await request(app.getHttpServer())
          .post(`${BASE_URL}/google/link`)
          .send({ linkToken: loginRes.body.data.linkToken })
          .expect(200);

        // Given - 신규 이메일이지만 providerUserId는 P(이미 사용중)인 signupToken 위조
        const newEmail = faker.internet.email().toLowerCase();
        const signupToken = buildSignupToken({
          email: newEmail,
          providerEmail: newEmail,
          providerUserId,
        });

        // When - createUser는 성공하지만 createUserSns가 unique 제약 위반
        const res = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/signup`)
          .send({ signupToken, nickname: buildNickname() });

        // Then - 에러 응답 + 트랜잭션 롤백으로 user 행이 남지 않음
        expect(res.status).toBeGreaterThanOrEqual(400);
        const users = await dataSource.query(
          `SELECT id FROM "user" WHERE email = $1`,
          [newEmail],
        );
        expect(users).toHaveLength(0);
      });

      it('jwtType이 signup 토큰이 아니면 401을 반환한다', async () => {
        // Given
        const wrongToken = tokenSigner.sign(
          {
            providerUserId: faker.string.numeric(21),
            email: faker.internet.email().toLowerCase(),
            jwtType: ONE_TIME_TOKEN_TYPE,
          },
          { expiresIn: '5m' },
        );

        // When
        const res = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/signup`)
          .send({ signupToken: wrongToken, nickname: buildNickname() });

        // Then
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('유효하지 않은 signup token입니다.');
      });

      it('nickname이 누락되면 400을 반환한다', async () => {
        // Given
        const signupToken = buildSignupToken();

        // When
        const res = await request(app.getHttpServer())
          .post(`${BASE_URL}/google/signup`)
          .send({ signupToken });

        // Then
        expect(res.status).toBe(400);
      });
    });
  });
});

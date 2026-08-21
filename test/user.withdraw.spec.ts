import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getAdminToken } from './setup/auth.helper';
import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

const USER_AUTH_BASE = '/user/auth';
const USER_BASE = '/user';
const ADMIN_MEMBER_BASE = '/admin/member';

function randomNickname(): string {
  return faker.internet
    .username()
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 20);
}

function buildSignUpBody(overrides?: Record<string, unknown>) {
  return {
    email: faker.internet.email().toLowerCase(),
    password: faker.internet.password({ length: 12 }),
    nickname: randomNickname(),
    ...overrides,
  };
}

describe('UserWithdraw (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득 (최초 1회만 부트스트랩)
    app = await getTestApp();
    dataSource = getDataSource(app);
  }, 60_000);

  afterEach(async () => {
    await truncateTables(dataSource, [
      'user_brand_like',
      'user_product_like',
      'user_recent',
      'user_sns',
      'user_fit',
      'user_profile_image',
      'user_profile',
      '"user"',
    ]);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // -------------------------------------------------------------------------
  // 헬퍼
  // -------------------------------------------------------------------------
  async function signUpAndLogin(overrides?: Record<string, unknown>): Promise<{
    userId: number;
    email: string;
    password: string;
    nickname: string;
    oneTimeToken: string;
    refreshToken: string;
  }> {
    const body = buildSignUpBody(overrides);

    const signupRes = await request(app.getHttpServer())
      .post(`${USER_AUTH_BASE}/signup`)
      .send(body);
    expect(signupRes.status).toBe(204);

    const loginRes = await request(app.getHttpServer())
      .post(`${USER_AUTH_BASE}/login`)
      .send({ email: body.email, password: body.password });
    expect(loginRes.status).toBe(200);

    const [userRow] = await dataSource.query(
      `SELECT id FROM "user" WHERE email = $1`,
      [body.email],
    );

    return {
      userId: Number(userRow.id),
      email: body.email,
      password: body.password,
      nickname: body.nickname,
      oneTimeToken: loginRes.body.data.token as string,
      refreshToken: loginRes.body.data.refreshToken as string,
    };
  }

  /** 소프트 삭제된 행까지 포함해 user 를 그대로 읽는다. */
  async function findUserRow(userId: number): Promise<Record<string, any>> {
    const [row] = await dataSource.query(`SELECT * FROM "user" WHERE id = $1`, [
      userId,
    ]);

    return row;
  }

  async function countRows(table: string, userId: number): Promise<number> {
    const [row] = await dataSource.query(
      `SELECT COUNT(*)::int AS count FROM ${table} WHERE user_id = $1`,
      [userId],
    );

    return row.count;
  }

  /** auth.helper 가 만든 테스트 관리자를 super_admin/NORMAL 로 승격한다. */
  async function promoteAdminsToSuperAdmin(): Promise<void> {
    await dataSource.query(
      `UPDATE admin
          SET role_id = (SELECT id FROM admin_role WHERE name = 'super_admin'),
              status = 'NORMAL'`,
    );
  }

  // -------------------------------------------------------------------------
  // DELETE /user
  // -------------------------------------------------------------------------
  describe('DELETE /user', () => {
    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).delete(USER_BASE);

      // Then
      expect(res.status).toBe(401);
    });

    it('탈퇴하면 계정이 소프트 삭제되고 식별정보가 익명화된다', async () => {
      // Given
      const { userId, email, nickname, oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .delete(USER_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(200);

      const row = await findUserRow(userId);
      expect(row.delete_date).not.toBeNull();
      expect(row.email).not.toBe(email);
      expect(row.email).toMatch(
        new RegExp(`^withdrawn-${userId}-[0-9a-f]{8}@withdrawn\\.invalid$`),
      );
      expect(row.nickname).not.toBe(nickname);
      expect(row.nickname).toMatch(new RegExp(`^탈퇴회원-${userId}-`));
      expect(row.phone).toBeNull();
      expect(row.refresh_token).toBeNull();
      expect(row.password).toBe('');
    });

    it('탈퇴하면 프로필의 개인정보가 지워지고 소프트 삭제된다', async () => {
      // Given - 프로필까지 채운 회원
      const { userId, oneTimeToken } = await signUpAndLogin();

      const profileRes = await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({
          nickname: randomNickname(),
          name: faker.person.fullName(),
          gender: 'MALE',
          birthDate: '1990-01-01',
          postalCode: '12345',
          city: '서울',
          district: '강남구',
          detailAddress: faker.location.streetAddress(),
        });
      expect(profileRes.status).toBe(201);

      // When
      const res = await request(app.getHttpServer())
        .delete(USER_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(200);

      const [profile] = await dataSource.query(
        `SELECT * FROM user_profile WHERE user_id = $1`,
        [userId],
      );
      expect(profile.delete_date).not.toBeNull();
      expect(profile.name).toBeNull();
      expect(profile.gender).toBeNull();
      expect(profile.birth_date).toBeNull();
      expect(profile.postal_code).toBeNull();
      expect(profile.city).toBeNull();
      expect(profile.district).toBeNull();
      expect(profile.detail_address).toBeNull();
    });

    it('탈퇴하면 체형 정보가 소프트 삭제된다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();

      const fitRes = await request(app.getHttpServer())
        .post(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ height: 180, weight: 70, shoeSize: 270 });
      expect(fitRes.status).toBe(201);

      // When
      const res = await request(app.getHttpServer())
        .delete(USER_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(200);

      const [fit] = await dataSource.query(
        `SELECT * FROM user_fit WHERE user_id = $1`,
        [userId],
      );
      expect(fit.delete_date).not.toBeNull();
    });

    it('탈퇴하면 SNS 연동과 최근 본 상품이 물리 삭제된다', async () => {
      // Given - 연동/최근본 행을 직접 심는다 (외부 SNS 호출 없이 검증)
      const { userId, oneTimeToken } = await signUpAndLogin();

      await dataSource.query(
        `INSERT INTO user_sns (user_id, provider, provider_user_id, provider_email)
         VALUES ($1, 'GOOGLE', $2, $3)`,
        [userId, `google-${userId}`, `sns-${userId}@test.com`],
      );

      expect(await countRows('user_sns', userId)).toBe(1);

      // When
      const res = await request(app.getHttpServer())
        .delete(USER_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(200);
      expect(await countRows('user_sns', userId)).toBe(0);
      expect(await countRows('user_recent', userId)).toBe(0);
    });

    it('탈퇴 후 기존 액세스 토큰으로 API를 호출하면 401을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      const withdrawRes = await request(app.getHttpServer())
        .delete(USER_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`);
      expect(withdrawRes.status).toBe(200);

      // When
      const res = await request(app.getHttpServer())
        .get(`${USER_BASE}/info`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(401);
    });

    it('탈퇴 후 기존 리프레시 토큰으로 재발급하면 401을 반환한다', async () => {
      // Given
      const { oneTimeToken, refreshToken } = await signUpAndLogin();

      const withdrawRes = await request(app.getHttpServer())
        .delete(USER_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`);
      expect(withdrawRes.status).toBe(200);

      // When
      const res = await request(app.getHttpServer())
        .get(`${USER_AUTH_BASE}/one-time-token`)
        .set('Authorization', `Bearer ${refreshToken}`);

      // Then
      expect(res.status).toBe(401);
    });

    it('탈퇴한 계정으로는 로그인할 수 없다', async () => {
      // Given
      const { email, password, oneTimeToken } = await signUpAndLogin();

      const withdrawRes = await request(app.getHttpServer())
        .delete(USER_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`);
      expect(withdrawRes.status).toBe(200);

      // When
      const res = await request(app.getHttpServer())
        .post(`${USER_AUTH_BASE}/login`)
        .send({ email, password });

      // Then
      expect(res.status).toBe(401);
    });

    it('탈퇴한 이메일과 닉네임으로 다시 가입할 수 있다', async () => {
      // Given
      const { email, nickname, oneTimeToken } = await signUpAndLogin();

      const withdrawRes = await request(app.getHttpServer())
        .delete(USER_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`);
      expect(withdrawRes.status).toBe(200);

      // When
      const res = await request(app.getHttpServer())
        .post(`${USER_AUTH_BASE}/signup`)
        .send({
          email,
          password: faker.internet.password({ length: 12 }),
          nickname,
        });

      // Then
      expect(res.status).toBe(204);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /admin/member/:userId
  // -------------------------------------------------------------------------
  describe('DELETE /admin/member/:userId', () => {
    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).delete(
        `${ADMIN_MEMBER_BASE}/1`,
      );

      // Then
      expect(res.status).toBe(401);
    });

    it('super_admin이 회원을 강제 탈퇴시키면 202와 함께 익명화된다', async () => {
      // Given
      const { userId, email } = await signUpAndLogin();
      const adminToken = await getAdminToken(app);
      await promoteAdminsToSuperAdmin();

      // When
      const res = await request(app.getHttpServer())
        .delete(`${ADMIN_MEMBER_BASE}/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Then
      expect(res.status).toBe(202);

      const row = await findUserRow(userId);
      expect(row.delete_date).not.toBeNull();
      expect(row.email).not.toBe(email);
      expect(row.refresh_token).toBeNull();
    });

    it('강제 탈퇴된 회원의 토큰은 즉시 무효화된다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const adminToken = await getAdminToken(app);
      await promoteAdminsToSuperAdmin();

      const withdrawRes = await request(app.getHttpServer())
        .delete(`${ADMIN_MEMBER_BASE}/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(withdrawRes.status).toBe(202);

      // When
      const res = await request(app.getHttpServer())
        .get(`${USER_BASE}/info`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(401);
    });

    it('이미 탈퇴했거나 없는 회원이면 404를 반환한다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const adminToken = await getAdminToken(app);
      await promoteAdminsToSuperAdmin();

      const withdrawRes = await request(app.getHttpServer())
        .delete(USER_BASE)
        .set('Authorization', `Bearer ${oneTimeToken}`);
      expect(withdrawRes.status).toBe(200);

      // When
      const res = await request(app.getHttpServer())
        .delete(`${ADMIN_MEMBER_BASE}/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Then
      expect(res.status).toBe(404);
    });
  });
});

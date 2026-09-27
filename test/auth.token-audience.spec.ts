import { JwtAudience, JwtType } from '@app/auth/auth.dto';
import { Configuration } from '@app/config/configuration';
import { faker } from '@faker-js/faker';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OptionalUserGuard } from 'apps/api/src/guard/optional-user.guard';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { clearTokenCache, getAdminToken } from './setup/auth.helper';
import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

/**
 * 관리자·회원 토큰은 같은 시크릿과 같은 jwtType 으로 서명된다. 예전에는
 * 이 둘을 가르는 값이 없어서 다음이 모두 통과했다.
 * - 회원 토큰으로 관리자 API 호출
 * - id 가 없는 토큰(분리 전 plen 토큰)으로 호출 — TypeORM 이 where 의
 *   undefined 를 "조건 없음"으로 보고 첫 행을 돌려준다
 */
describe('인증 토큰 대상 분리 (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const ADMIN_MEMBER_URL = '/admin/member'; // AdminRoleGuard (역할 지정 없음)
  const ADMIN_CATEGORY_URL = '/admin/category'; // OneTimeTokenGuard
  const USER_INFO_URL = '/user/info'; // UserOneTimeTokenGuard

  function sign(payload: Record<string, unknown>, secret?: string): string {
    return jwt.sign(payload, secret ?? Configuration.getConfig().JWT_SECRET, {
      expiresIn: '1h',
    });
  }

  function get(url: string, token: string) {
    return request(app.getHttpServer())
      .get(url)
      .set('Authorization', `Bearer ${token}`);
  }

  async function getAdminId(): Promise<number> {
    const rows = await dataSource.query(
      `SELECT id FROM admin WHERE email = 'e2e-test-admin@test.com'`,
    );
    return rows[0].id;
  }

  async function signUpAndLogin(): Promise<{
    userId: number;
    oneTimeToken: string;
    refreshToken: string;
  }> {
    const body = {
      email: faker.internet.email().toLowerCase(),
      password: faker.internet.password({ length: 12 }),
      nickname: faker.string.alphanumeric(12),
    };

    await request(app.getHttpServer())
      .post('/user/auth/signup')
      .send(body)
      .expect(204);

    const loginRes = await request(app.getHttpServer())
      .post('/user/auth/login')
      .send({ email: body.email, password: body.password })
      .expect(200);

    const rows = await dataSource.query(
      `SELECT id FROM "user" WHERE email = $1`,
      [body.email],
    );

    return {
      userId: rows[0].id,
      oneTimeToken: loginRes.body.data.token,
      refreshToken: loginRes.body.data.refreshToken,
    };
  }

  beforeAll(async () => {
    app = await getTestApp();
    dataSource = getDataSource(app);
  }, 60_000);

  afterAll(async () => {
    await truncateTables(dataSource, [
      'user_sns',
      'user_fit',
      'user_profile',
      '"user"',
    ]);
    clearTokenCache();
    await closeTestApp();
  });

  describe('관리자 API', () => {
    it('관리자 로그인으로 받은 토큰은 통과한다', async () => {
      // Given
      const adminToken = await getAdminToken(app);

      // When
      const memberRes = await get(ADMIN_MEMBER_URL, adminToken);
      const categoryRes = await get(ADMIN_CATEGORY_URL, adminToken);

      // Then
      expect(memberRes.status).toBe(200);
      expect(categoryRes.status).toBe(200);
      expect(jwt.decode(adminToken)).toMatchObject({
        aud: JwtAudience.ADMIN,
      });
    });

    it('id 가 없는 토큰(분리 전 plen 토큰 형식)은 401', async () => {
      // Given - 관리자가 한 명 이상 있어야 "첫 행" 으로 통과하던 경로가 드러난다
      await getAdminToken(app);
      const idless = sign({
        platformType: 'kakao',
        planUserId: faker.string.uuid(),
        kakaoId: 1,
        jwtType: JwtType.ONE_TIME_TOKEN,
      });

      // When
      const memberRes = await get(ADMIN_MEMBER_URL, idless);
      const categoryRes = await get(ADMIN_CATEGORY_URL, idless);

      // Then
      expect(memberRes.status).toBe(401);
      expect(categoryRes.status).toBe(401);
    });

    it('회원 로그인으로 받은 토큰은 401', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const memberRes = await get(ADMIN_MEMBER_URL, oneTimeToken);
      const categoryRes = await get(ADMIN_CATEGORY_URL, oneTimeToken);

      // Then
      expect(memberRes.status).toBe(401);
      expect(categoryRes.status).toBe(401);
    });

    it('aud 가 없는 예전 형식 토큰은 id 가 관리자와 같아도 401', async () => {
      // Given - 예전 회원 토큰과 구별할 수 없는 모양이다
      await getAdminToken(app);
      const legacy = sign({
        id: await getAdminId(),
        jwtType: JwtType.ONE_TIME_TOKEN,
      });

      // When
      const memberRes = await get(ADMIN_MEMBER_URL, legacy);
      const categoryRes = await get(ADMIN_CATEGORY_URL, legacy);

      // Then
      expect(memberRes.status).toBe(401);
      expect(categoryRes.status).toBe(401);
    });

    it('aud 가 admin 이어도 id 가 없거나 정수가 아니면 401', async () => {
      // Given
      await getAdminToken(app);
      const noId = sign({
        aud: JwtAudience.ADMIN,
        jwtType: JwtType.ONE_TIME_TOKEN,
      });
      const stringId = sign({
        id: String(await getAdminId()),
        aud: JwtAudience.ADMIN,
        jwtType: JwtType.ONE_TIME_TOKEN,
      });

      for (const token of [noId, stringId]) {
        // When
        const memberRes = await get(ADMIN_MEMBER_URL, token);
        const categoryRes = await get(ADMIN_CATEGORY_URL, token);

        // Then
        expect(memberRes.status).toBe(401);
        expect(categoryRes.status).toBe(401);
      }
    });

    it('다른 시크릿으로 서명한 토큰은 500 이 아니라 401', async () => {
      // Given
      const forged = sign(
        {
          id: 1,
          aud: JwtAudience.ADMIN,
          jwtType: JwtType.ONE_TIME_TOKEN,
        },
        'not-the-secret',
      );

      // When
      const res = await get(ADMIN_MEMBER_URL, forged);

      // Then
      expect(res.status).toBe(401);
    });

    it('회원 refresh 토큰으로는 관리자 one-time 토큰을 받을 수 없다', async () => {
      // Given
      const { refreshToken } = await signUpAndLogin();

      // When
      const res = await get('/admin/auth/one-time-token', refreshToken);

      // Then
      expect(res.status).toBe(403);
    });

    it('DB 에 저장된 refresh 토큰이라도 aud 가 admin 이 아니면 403 (배포 전 관리자는 재로그인)', async () => {
      // Given - 저장값 대조는 통과하도록 관리자 행에 직접 넣는다.
      // 다음 관리자 로그인이 refresh_token 을 덮어쓰므로 다른 spec 에 영향이 없다.
      await getAdminToken(app);
      const adminId = await getAdminId();
      const legacy = sign({ id: adminId, jwtType: JwtType.REFRESH_TOKEN });
      const userAudience = sign({
        id: adminId,
        aud: JwtAudience.USER,
        jwtType: JwtType.REFRESH_TOKEN,
      });

      for (const token of [legacy, userAudience]) {
        await dataSource.query(
          `UPDATE admin SET refresh_token = $1 WHERE id = $2`,
          [token, adminId],
        );

        // When
        const res = await get('/admin/auth/one-time-token', token);

        // Then
        expect(res.status).toBe(403);
      }
    });
  });

  describe('회원 API', () => {
    it('회원 로그인으로 받은 토큰은 통과하고 aud 가 user 다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await get(USER_INFO_URL, oneTimeToken);

      // Then
      expect(res.status).toBe(200);
      expect(jwt.decode(oneTimeToken)).toMatchObject({
        aud: JwtAudience.USER,
      });
    });

    it('aud 가 없는 예전 회원 토큰도 계속 받는다', async () => {
      // Given - 배포 전에 발급된 회원 토큰
      const { userId } = await signUpAndLogin();
      const legacy = sign({ id: userId, jwtType: JwtType.ONE_TIME_TOKEN });

      // When
      const res = await get(USER_INFO_URL, legacy);

      // Then
      expect(res.status).toBe(200);
    });

    it('관리자 토큰은 401', async () => {
      // Given - 같은 번호의 회원이 있어도 관리자 토큰으로는 들어올 수 없다
      const { userId } = await signUpAndLogin();
      const adminAudience = sign({
        id: userId,
        aud: JwtAudience.ADMIN,
        jwtType: JwtType.ONE_TIME_TOKEN,
      });

      // When
      const res = await get(USER_INFO_URL, adminAudience);

      // Then
      expect(res.status).toBe(401);
    });

    it('id 가 없는 토큰은 401', async () => {
      // Given - 회원이 한 명 이상 있어야 "첫 행" 으로 통과하던 경로가 드러난다
      await signUpAndLogin();
      const idless = sign({
        planUserId: faker.string.uuid(),
        jwtType: JwtType.ONE_TIME_TOKEN,
      });

      // When
      const res = await get(USER_INFO_URL, idless);

      // Then
      expect(res.status).toBe(401);
    });
  });

  describe('OptionalUserGuard (비로그인 허용 API)', () => {
    async function resolveUserId(token: string): Promise<number | undefined> {
      const guard = new OptionalUserGuard(
        new JwtService({ secret: Configuration.getConfig().JWT_SECRET }),
      );
      const req = { headers: { authorization: `Bearer ${token}` } } as {
        headers: Record<string, string>;
        userId?: number;
      };
      const context = {
        switchToHttp: () => ({ getRequest: () => req }),
      } as unknown as ExecutionContext;

      // When
      await expect(guard.canActivate(context)).resolves.toBe(true);

      return req.userId;
    }

    it('회원 액세스 토큰은 aud 가 있든 없든 회원으로 본다', async () => {
      // Given
      const withAudience = sign({
        id: 7,
        aud: JwtAudience.USER,
        jwtType: JwtType.ONE_TIME_TOKEN,
      });
      const legacy = sign({ id: 7, jwtType: JwtType.ONE_TIME_TOKEN });

      // Then
      expect(await resolveUserId(withAudience)).toBe(7);
      expect(await resolveUserId(legacy)).toBe(7);
    });

    it('관리자 토큰·refresh 토큰·id 없는 토큰은 익명으로 둔다', async () => {
      // Given
      const tokens = [
        sign({
          id: 7,
          aud: JwtAudience.ADMIN,
          jwtType: JwtType.ONE_TIME_TOKEN,
        }),
        sign({ id: 7, jwtType: JwtType.REFRESH_TOKEN }),
        sign({
          planUserId: faker.string.uuid(),
          jwtType: JwtType.ONE_TIME_TOKEN,
        }),
      ];

      // Then
      for (const token of tokens) {
        expect(await resolveUserId(token)).toBeUndefined();
      }
    });
  });
});

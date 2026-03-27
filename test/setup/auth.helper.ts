import { INestApplication } from '@nestjs/common';
import request from 'supertest';

const TEST_ADMIN_EMAIL = 'e2e-test-admin@test.com';
const TEST_ADMIN_PASSWORD = 'TestAdmin1234!';
const TEST_ADMIN_NAME = 'E2E테스트관리자';

let cachedToken: string | null = null;

/**
 * E2E 테스트용 Admin 토큰을 획득한다.
 * 최초 호출 시에만 signup → login → one-time-token 흐름을 거치고,
 * 이후 호출에서는 메모리에 캐시된 토큰을 반환한다.
 *
 * 인증 흐름:
 *   1. POST /admin/auth/signup  (이미 존재하면 무시)
 *   2. POST /admin/auth/login   → refreshToken 획득
 *   3. GET  /admin/auth/one-time-token (Bearer refreshToken) → oneTimeToken 획득
 *   4. 이후 모든 admin API 요청에 oneTimeToken 사용
 *
 * 사용 예:
 *   const token = await getAdminToken(app);
 *   await request(app.getHttpServer())
 *     .get('/admin/news')
 *     .set('Authorization', `Bearer ${token}`)
 */
export async function getAdminToken(app: INestApplication): Promise<string> {
  if (cachedToken) return cachedToken;

  // Given - 테스트 admin 계정 생성 (이미 존재하면 409를 무시)
  await request(app.getHttpServer()).post('/admin/auth/signup').send({
    email: TEST_ADMIN_EMAIL,
    password: TEST_ADMIN_PASSWORD,
    name: TEST_ADMIN_NAME,
  });

  // When - 로그인으로 refreshToken 획득
  const loginRes = await request(app.getHttpServer())
    .post('/admin/auth/login')
    .send({
      email: TEST_ADMIN_EMAIL,
      password: TEST_ADMIN_PASSWORD,
    });

  if (loginRes.status !== 200) {
    throw new Error(
      `Admin login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`,
    );
  }

  const { refreshToken } = loginRes.body.data;

  // When - refreshToken으로 oneTimeToken 발급
  const tokenRes = await request(app.getHttpServer())
    .get('/admin/auth/one-time-token')
    .set('Authorization', `Bearer ${refreshToken}`);

  if (tokenRes.status !== 200) {
    throw new Error(
      `one-time-token 발급 실패: ${tokenRes.status} ${JSON.stringify(tokenRes.body)}`,
    );
  }

  cachedToken = tokenRes.body.data.oneTimeToken;

  return cachedToken;
}

/**
 * 캐시된 토큰을 초기화한다.
 * 토큰 만료 시 또는 테스트 스위트 종료 후 호출한다.
 */
export function clearTokenCache(): void {
  cachedToken = null;
}

/**
 * Authorization 헤더 문자열을 반환하는 유틸 함수.
 *
 * 사용 예:
 *   .set('Authorization', await authHeader(app))
 */
export async function authHeader(app: INestApplication): Promise<string> {
  const token = await getAdminToken(app);
  return `Bearer ${token}`;
}

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { clearTokenCache, getAdminToken } from './setup/auth.helper';
import { getDataSource } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

const BASE = '/admin/user';
const OTHER = { email: 'e2e-other-admin@test.com', password: 'Other1234!' };

describe('AdminUserController — 관리자 권한 관리 (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let adminId: number;
  let otherId: number;

  beforeAll(async () => {
    app = await getTestApp();
    dataSource = getDataSource(app);

    // 다른 spec 이 admin 테이블을 비웠을 수 있어 캐시를 버리고 다시 받는다
    clearTokenCache();
    adminToken = await getAdminToken(app);
    // admin.email 에 유니크가 없어 같은 메일이 여러 줄일 수 있다 — 토큰의 주인을 쓴다
    adminId = JSON.parse(
      Buffer.from(adminToken.split('.')[1], 'base64').toString(),
    ).id;
    await dataSource.query(`DELETE FROM admin WHERE email = $1`, [OTHER.email]);
    await request(app.getHttpServer())
      .post('/admin/auth/signup')
      .send({ ...OTHER, name: '다른관리자' });

    otherId = await idOf(OTHER.email);
  }, 60_000);

  beforeEach(async () => {
    // 테스트 관리자는 super_admin · NORMAL, 다른 관리자는 가입 직후(admin · WAIT) 상태로 되돌린다
    await setAdmin(adminId, 'super_admin', 'NORMAL');
    await setAdmin(otherId, 'admin', 'WAIT');
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM admin WHERE id = $1`, [otherId]);
    await closeTestApp();
  });

  async function idOf(email: string): Promise<number> {
    const rows = await dataSource.query(
      `SELECT id FROM admin WHERE email = $1`,
      [email],
    );

    return rows[0].id;
  }

  async function setAdmin(id: number, role: string, status: string) {
    await dataSource.query(
      `UPDATE admin
          SET role_id = (SELECT id FROM admin_role WHERE name = $2), status = $3
        WHERE id = $1`,
      [id, role, status],
    );
  }

  function patch(id: number, body: Record<string, unknown>, token?: string) {
    return request(app.getHttpServer())
      .patch(`${BASE}/${id}`)
      .set('Authorization', `Bearer ${token ?? adminToken}`)
      .send(body);
  }

  async function loginOther(): Promise<string> {
    const login = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send(OTHER);
    const token = await request(app.getHttpServer())
      .get('/admin/auth/one-time-token')
      .set('Authorization', `Bearer ${login.body.data.refreshToken}`);

    return token.body.data.oneTimeToken;
  }

  it('super_admin 이 다른 관리자를 super_admin · NORMAL 로 올리면 바로 super_admin API 를 쓸 수 있다', async () => {
    // Given - 가입 직후 계정은 권한 관리 API 를 쓸 수 없다
    const otherToken = await loginOther();
    expect((await patch(adminId, { status: 'BLOCK' }, otherToken)).status).toBe(
      403,
    );

    // When
    const res = await patch(otherId, {
      role: 'super_admin',
      status: 'NORMAL',
    });

    // Then - 다시 로그인하지 않아도 같은 토큰으로 통과한다
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: otherId,
      email: OTHER.email,
      role: 'super_admin',
      status: 'NORMAL',
    });
    const list = await request(app.getHttpServer())
      .get(BASE)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(list.status).toBe(200);
    expect(
      list.body.data.list.find((x: any) => x.id === otherId),
    ).toMatchObject({ role: 'super_admin', status: 'NORMAL' });
  });

  it('보낸 필드만 바뀐다 — 역할만 내리면 상태는 그대로다', async () => {
    // Given
    await setAdmin(otherId, 'super_admin', 'NORMAL');

    // When
    const res = await patch(otherId, { role: 'admin' });

    // Then
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ role: 'admin', status: 'NORMAL' });
  });

  it('자기 자신·없는 계정·빈 요청·없는 역할은 바꾸지 않는다', async () => {
    // When / Then
    expect((await patch(adminId, { role: 'admin' })).status).toBe(409);
    expect((await patch(999999, { role: 'admin' })).status).toBe(404);
    expect((await patch(otherId, {})).status).toBe(400);
    expect((await patch(otherId, { role: 'owner' })).status).toBe(400);
    expect((await patch(otherId, { status: 'GONE' })).status).toBe(400);

    const rows = await dataSource.query(
      `SELECT r.name AS role, a.status FROM admin a JOIN admin_role r ON r.id = a.role_id
        WHERE a.id IN ($1, $2) ORDER BY a.id`,
      [adminId, otherId],
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        { role: 'super_admin', status: 'NORMAL' },
        { role: 'admin', status: 'WAIT' },
      ]),
    );
  });
});

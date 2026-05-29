import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { UserProfileGender } from '../libs/repository/src/enum/user-profile.enum';

const USER_AUTH_BASE = '/user/auth';
const USER_BASE = '/user';

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

function buildProfileBody(overrides?: Record<string, unknown>) {
  return {
    nickname: randomNickname(),
    name: faker.person.fullName(),
    gender: UserProfileGender.MALE,
    birthDate: '1990-01-01',
    postalCode: '12345',
    city: '서울',
    district: '강남구',
    detailAddress: faker.location.streetAddress(),
    ...overrides,
  };
}

function buildProfilePatchBody(overrides?: Record<string, unknown>) {
  return {
    gender: UserProfileGender.FEMALE,
    birthDate: '1995-05-05',
    postalCode: '54321',
    city: '인천',
    district: '연수구',
    detailAddress: faker.location.streetAddress(),
    ...overrides,
  };
}

function uniqueName(prefix = '테스트'): string {
  return `${prefix}_${faker.string.alphanumeric(10)}`;
}

function buildFitBody(overrides?: Record<string, unknown>) {
  return {
    height: 180,
    weight: 70,
    shoeSize: 270,
    outerSize: 'M',
    topSize: 'M',
    bottomSize: '32',
    ...overrides,
  };
}

describe('UserController (E2E)', () => {
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
  // 헬퍼: signup + login → oneTimeToken 획득
  // -------------------------------------------------------------------------
  async function signUpAndLogin(overrides?: Record<string, unknown>): Promise<{
    userId: number;
    email: string;
    nickname: string;
    oneTimeToken: string;
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

    const userRow = await dataSource.query(
      `SELECT id FROM "user" WHERE email = $1`,
      [body.email],
    );

    return {
      userId: userRow[0].id,
      email: body.email,
      nickname: body.nickname,
      oneTimeToken: loginRes.body.data.token as string,
    };
  }

  // -------------------------------------------------------------------------
  // GET /user/info
  // -------------------------------------------------------------------------
  describe('GET /user/info', () => {
    it('정상 조회 시 200과 유저 정보를 반환한다', async () => {
      // Given - 가입 시 광고/추천 동의는 true, 신상품 알림은 미선택
      const { email, oneTimeToken } = await signUpAndLogin({
        adAgreed: true,
        recommendAgreed: true,
      });

      // When
      const res = await request(app.getHttpServer())
        .get(`${USER_BASE}/info`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.result).toBe(true);
      expect(res.body.data.email).toBe(email);
      expect(res.body.data.adAgreed).toBe(true);
      expect(res.body.data.recommendAgreed).toBe(true);
      expect(res.body.data.newProductAgreed).toBe(false);
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).get(`${USER_BASE}/info`);

      // Then
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /user/info
  // -------------------------------------------------------------------------
  describe('PATCH /user/info', () => {
    it('정상 수정 시 200을 반환하고 동의 일시가 DB에 반영된다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/info`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({
          newProductAgreed: true,
          adAgreed: true,
          recommendAgreed: true,
        });

      // Then
      expect(res.status).toBe(200);
      const rows = await dataSource.query(
        `SELECT new_product_date, ad_agree_date, recommend_date
         FROM "user" WHERE id = $1`,
        [userId],
      );
      expect(rows[0].new_product_date).toBeInstanceOf(Date);
      expect(rows[0].ad_agree_date).toBeInstanceOf(Date);
      expect(rows[0].recommend_date).toBeInstanceOf(Date);
    });

    it('동의 boolean이 false면 해당 컬럼이 NULL로 저장된다', async () => {
      // Given - 가입 시 모든 동의 컬럼을 채움
      const { userId, oneTimeToken } = await signUpAndLogin({
        newProductAgreed: true,
        adAgreed: true,
        recommendAgreed: true,
      });

      // When - 모두 false로 PATCH
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/info`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({
          newProductAgreed: false,
          adAgreed: false,
          recommendAgreed: false,
        });

      // Then
      expect(res.status).toBe(200);
      const rows = await dataSource.query(
        `SELECT new_product_date, ad_agree_date, recommend_date
         FROM "user" WHERE id = $1`,
        [userId],
      );
      expect(rows[0].new_product_date).toBeNull();
      expect(rows[0].ad_agree_date).toBeNull();
      expect(rows[0].recommend_date).toBeNull();
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/info`)
        .send({
          newProductAgreed: true,
          adAgreed: true,
          recommendAgreed: true,
        });

      // Then
      expect(res.status).toBe(401);
    });

    it('허용되지 않은 필드(email)가 포함되면 400을 반환한다', async () => {
      // Given - DTO에서 제거된 email 필드는 forbidNonWhitelisted로 거부되어야 함
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/info`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({
          email: faker.internet.email().toLowerCase(),
          newProductAgreed: true,
          adAgreed: true,
          recommendAgreed: true,
        });

      // Then
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // POST /user/profile
  // -------------------------------------------------------------------------
  describe('POST /user/profile', () => {
    it('정상 생성 시 201을 반환하고 DB에 프로필이 저장되며 user.nickname도 갱신된다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const body = buildProfileBody();

      // When
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(body);

      // Then
      expect(res.status).toBe(201);
      const profileRows = await dataSource.query(
        `SELECT user_id, name, gender, birth_date,
                postal_code, city, district, detail_address
         FROM user_profile WHERE user_id = $1`,
        [userId],
      );
      expect(profileRows).toHaveLength(1);
      expect(profileRows[0].name).toBe(body.name);
      expect(profileRows[0].gender).toBe(body.gender);
      expect(profileRows[0].postal_code).toBe(body.postalCode);
      expect(profileRows[0].city).toBe(body.city);
      expect(profileRows[0].district).toBe(body.district);
      expect(profileRows[0].detail_address).toBe(body.detailAddress);

      // user.nickname이 프로필 요청의 nickname으로 갱신되어야 함
      const userRows = await dataSource.query(
        `SELECT nickname FROM "user" WHERE id = $1`,
        [userId],
      );
      expect(userRows[0].nickname).toBe(body.nickname);
    });

    it('profileImageUrl 같은 unknown 필드가 포함되면 400을 반환한다', async () => {
      // Given - 이미지 등록은 별도 endpoint이므로 profile DTO는 unknown 필드를 거부해야 한다
      const { oneTimeToken } = await signUpAndLogin();
      const body = {
        ...buildProfileBody(),
        profileImageUrl: faker.image.url(),
      };

      // When
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(body);

      // Then
      expect(res.status).toBe(400);
    });

    it('nickname이 누락되면 400을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const body = buildProfileBody();
      delete (body as Record<string, unknown>).nickname;

      // When
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(body);

      // Then
      expect(res.status).toBe(400);
    });

    it('다른 사용자가 이미 사용 중인 nickname이면 409를 반환한다', async () => {
      // Given - 첫 사용자는 nickname A로 가입, 두 번째 사용자는 다른 nickname으로 가입 후 프로필 생성을 nickname A로 시도
      const first = await signUpAndLogin();
      const second = await signUpAndLogin();
      const body = buildProfileBody({ nickname: first.nickname });

      // When
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${second.oneTimeToken}`)
        .send(body);

      // Then
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('User nickname already exists');
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .send(buildProfileBody());

      // Then
      expect(res.status).toBe(401);
    });

    it('필수 필드(name)가 누락되면 400을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const body = buildProfileBody();
      delete (body as Record<string, unknown>).name;

      // When
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(body);

      // Then
      expect(res.status).toBe(400);
    });

    it('birthDate 형식이 YYYY-MM-DD가 아니면 400을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const body = buildProfileBody({ birthDate: '1990/01/01' });

      // When
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(body);

      // Then
      expect(res.status).toBe(400);
    });

    it('gender enum이 잘못되면 400을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const body = buildProfileBody({ gender: 'INVALID' });

      // When
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(body);

      // Then
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /user/profile
  // -------------------------------------------------------------------------
  describe('PATCH /user/profile', () => {
    it('프로필이 없으면 404를 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildProfilePatchBody());

      // Then
      expect(res.status).toBe(404);
    });

    it('정상 수정 시 200을 반환하고 주소/성별 등이 DB에 반영된다', async () => {
      // Given - 먼저 프로필 생성
      const { userId, oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildProfileBody());

      // When - nickname/name 제외한 필드만 PATCH
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({
          city: '부산',
          district: '해운대구',
          detailAddress: '센텀로 123',
        });

      // Then
      expect(res.status).toBe(200);
      const rows = await dataSource.query(
        `SELECT city, district, detail_address FROM user_profile WHERE user_id = $1`,
        [userId],
      );
      expect(rows[0].city).toBe('부산');
      expect(rows[0].district).toBe('해운대구');
      expect(rows[0].detail_address).toBe('센텀로 123');
    });

    it('일부 필드만 전송해도 200을 반환하고 보낸 필드만 갱신된다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const initial = buildProfileBody();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(initial);

      // When - city만 전송
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ city: '대전' });

      // Then - city만 변경되고 나머지는 기존 값 유지
      expect(res.status).toBe(200);
      const rows = await dataSource.query(
        `SELECT city, district, postal_code FROM user_profile WHERE user_id = $1`,
        [userId],
      );
      expect(rows[0].city).toBe('대전');
      expect(rows[0].district).toBe(initial.district);
      expect(rows[0].postal_code).toBe(initial.postalCode);
    });

    it('빈 바디로도 200을 반환한다 (모든 필드 선택적)', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildProfileBody());

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({});

      // Then
      expect(res.status).toBe(200);
    });

    it('nickname 필드를 전송하면 400을 반환한다 (whitelist 거부)', async () => {
      // Given - PATCH /user/profile은 더 이상 nickname을 받지 않으므로 거부되어야 한다
      const { oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildProfileBody());

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ ...buildProfilePatchBody(), nickname: randomNickname() });

      // Then
      expect(res.status).toBe(400);
    });

    it('name 필드를 전송하면 400을 반환한다 (whitelist 거부)', async () => {
      // Given - PATCH /user/profile은 더 이상 name을 받지 않는다
      const { oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildProfileBody());

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ ...buildProfilePatchBody(), name: uniqueName() });

      // Then
      expect(res.status).toBe(400);
    });

    it('birthDate 형식이 YYYY-MM-DD가 아니면 400을 반환한다', async () => {
      // Given - 값이 있으면 @Matches 정규식 검증이 동작
      const { oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildProfileBody());

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ birthDate: '1990/01/01' });

      // Then
      expect(res.status).toBe(400);
    });

    it('gender enum이 잘못되면 400을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildProfileBody());

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ gender: 'INVALID' });

      // Then
      expect(res.status).toBe(400);
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile`)
        .send(buildProfilePatchBody());

      // Then
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /user/profile/nickname
  // -------------------------------------------------------------------------
  describe('PATCH /user/profile/nickname', () => {
    it('프로필이 없으면 404를 반환한다', async () => {
      // Given - profile은 없지만 user는 있는 상태
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile/nickname`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ nickname: randomNickname() });

      // Then
      expect(res.status).toBe(404);
    });

    it('정상 수정 시 200을 반환하고 user.nickname이 갱신된다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildProfileBody());

      const newNickname = randomNickname();

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile/nickname`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ nickname: newNickname });

      // Then
      expect(res.status).toBe(200);
      const rows = await dataSource.query(
        `SELECT nickname FROM "user" WHERE id = $1`,
        [userId],
      );
      expect(rows[0].nickname).toBe(newNickname);
    });

    it('자기 자신의 nickname을 그대로 보내도 200을 반환한다 (self-conflict 방지)', async () => {
      // Given
      const { userId, nickname, oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildProfileBody({ nickname }));

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile/nickname`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ nickname });

      // Then
      expect(res.status).toBe(200);
      const rows = await dataSource.query(
        `SELECT nickname FROM "user" WHERE id = $1`,
        [userId],
      );
      expect(rows[0].nickname).toBe(nickname);
    });

    it('다른 사용자가 사용 중인 nickname이면 409를 반환한다', async () => {
      // Given
      const first = await signUpAndLogin();
      const second = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${second.oneTimeToken}`)
        .send(buildProfileBody({ nickname: second.nickname }));

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile/nickname`)
        .set('Authorization', `Bearer ${second.oneTimeToken}`)
        .send({ nickname: first.nickname });

      // Then
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('User nickname already exists');
    });

    it('nickname이 누락되면 400을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildProfileBody());

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile/nickname`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({});

      // Then
      expect(res.status).toBe(400);
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile/nickname`)
        .send({ nickname: randomNickname() });

      // Then
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /user/profile/name
  // -------------------------------------------------------------------------
  describe('PATCH /user/profile/name', () => {
    it('프로필이 없으면 404를 반환한다', async () => {
      // Given - profile은 없지만 user는 있는 상태
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile/name`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ name: uniqueName() });

      // Then
      expect(res.status).toBe(404);
    });

    it('정상 수정 시 200을 반환하고 user_profile.name이 갱신된다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildProfileBody());

      const newName = uniqueName('새이름');

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile/name`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ name: newName });

      // Then
      expect(res.status).toBe(200);
      const rows = await dataSource.query(
        `SELECT name FROM user_profile WHERE user_id = $1`,
        [userId],
      );
      expect(rows[0].name).toBe(newName);
    });

    it('자기 자신의 name을 그대로 보내도 200을 반환한다 (self-conflict 방지)', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const profile = buildProfileBody({ name: uniqueName('동일') });
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(profile);

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile/name`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ name: profile.name });

      // Then
      expect(res.status).toBe(200);
      const rows = await dataSource.query(
        `SELECT name FROM user_profile WHERE user_id = $1`,
        [userId],
      );
      expect(rows[0].name).toBe(profile.name);
    });

    it('다른 사용자가 사용 중인 name이면 409를 반환한다', async () => {
      // Given - 첫 사용자가 고유 name으로 프로필 생성
      const first = await signUpAndLogin();
      const second = await signUpAndLogin();
      const sharedName = uniqueName('충돌');

      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${first.oneTimeToken}`)
        .send(buildProfileBody({ nickname: first.nickname, name: sharedName }));
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${second.oneTimeToken}`)
        .send(buildProfileBody({ nickname: second.nickname }));

      // When - second 사용자가 first의 name으로 PATCH 시도
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile/name`)
        .set('Authorization', `Bearer ${second.oneTimeToken}`)
        .send({ name: sharedName });

      // Then
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('User name already exists');
    });

    it('name이 누락되면 400을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildProfileBody());

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile/name`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({});

      // Then
      expect(res.status).toBe(400);
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile/name`)
        .send({ name: uniqueName() });

      // Then
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // GET /user/profile
  // -------------------------------------------------------------------------
  describe('GET /user/profile', () => {
    it('프로필이 없어도 200을 반환하고 nickname만 채워서 다른 필드는 null로 응답한다', async () => {
      // Given - profile은 생성하지 않은 신규 사용자
      const { nickname, oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .get(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.result).toBe(true);
      expect(res.body.data.nickname).toBe(nickname);
      expect(res.body.data.profileImageUrl).toBeNull();
      expect(res.body.data.name).toBeNull();
      expect(res.body.data.gender).toBeNull();
      expect(res.body.data.birthDate).toBeNull();
      expect(res.body.data.postalCode).toBeNull();
      expect(res.body.data.city).toBeNull();
      expect(res.body.data.district).toBeNull();
      expect(res.body.data.detailAddress).toBeNull();
    });

    it('프로필이 없을 때 조회하면 빈 user_profile row가 lazy 생성된다', async () => {
      // Given - profile이 없는 신규 사용자 (조회 전에는 row가 없어야 함)
      const { userId, oneTimeToken } = await signUpAndLogin();
      const before = await dataSource.query(
        `SELECT user_id FROM user_profile WHERE user_id = $1`,
        [userId],
      );
      expect(before).toHaveLength(0);

      // When - 프로필 조회
      const res = await request(app.getHttpServer())
        .get(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then - userId만 채워진 빈 프로필 row가 생성되어 있어야 한다
      expect(res.status).toBe(200);
      const rows = await dataSource.query(
        `SELECT user_id, name, gender, birth_date, postal_code,
                city, district, detail_address
         FROM user_profile WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].user_id).toBe(userId);
      expect(rows[0].name).toBeNull();
      expect(rows[0].gender).toBeNull();
      expect(rows[0].birth_date).toBeNull();
      expect(rows[0].postal_code).toBeNull();
      expect(rows[0].city).toBeNull();
      expect(rows[0].district).toBeNull();
      expect(rows[0].detail_address).toBeNull();
    });

    it('프로필이 없는 상태로 여러 번 조회해도 row가 중복 생성되지 않는다', async () => {
      // Given - profile이 없는 신규 사용자
      const { userId, oneTimeToken } = await signUpAndLogin();

      // When - 프로필을 두 번 연속 조회
      await request(app.getHttpServer())
        .get(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`);
      const res = await request(app.getHttpServer())
        .get(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then - lazy 생성된 row는 단 한 개만 유지된다
      expect(res.status).toBe(200);
      const rows = await dataSource.query(
        `SELECT user_id FROM user_profile WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(1);
    });

    it('정상 조회 시 200과 프로필 정보를 반환하고 nickname은 user.nickname을 따른다', async () => {
      // Given - 이미지를 등록하지 않은 상태이므로 profileImageUrl은 비어야 함
      const { oneTimeToken } = await signUpAndLogin();
      const profileBody = buildProfileBody();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(profileBody);

      // When
      const res = await request(app.getHttpServer())
        .get(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.result).toBe(true);
      expect(res.body.data.profileImageUrl).toBeFalsy();
      expect(res.body.data.nickname).toBe(profileBody.nickname);
      expect(res.body.data.name).toBe(profileBody.name);
      expect(res.body.data.gender).toBe(profileBody.gender);
      expect(res.body.data.birthDate).toBe(profileBody.birthDate);
      expect(res.body.data.postalCode).toBe(profileBody.postalCode);
      expect(res.body.data.city).toBe(profileBody.city);
      expect(res.body.data.district).toBe(profileBody.district);
      expect(res.body.data.detailAddress).toBe(profileBody.detailAddress);
    });

    it('프로필 이미지 등록 후 조회하면 profileImageUrl이 채워진다', async () => {
      // Given - 프로필 생성 + 이미지 등록
      const { oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildProfileBody());

      const imageUrl = '/uploads/profile/test.webp';
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile/image`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ imageUrl });

      // When
      const res = await request(app.getHttpServer())
        .get(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then - IMAGE_DOMAIN_NAME이 빈 문자열인 테스트 환경에서는 path 그대로 반환된다
      expect(res.status).toBe(200);
      expect(res.body.data.profileImageUrl).toBe(imageUrl);
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).get(
        `${USER_BASE}/profile`,
      );

      // Then
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // POST /user/profile/image
  // -------------------------------------------------------------------------
  describe('POST /user/profile/image', () => {
    async function createProfile(oneTimeToken: string) {
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildProfileBody());
      expect(res.status).toBe(201);
    }

    it('프로필이 없어도 201을 반환하고 이미지가 저장된다 (프로필 존재 검증 제거됨)', async () => {
      // Given - 프로필 생성 없이 이미지 등록 시도
      // 리팩터링으로 postUserProfileImage의 getUserProfile 사전 검증이 제거되어
      // 프로필이 없어도 user_profile_image row가 곧바로 생성된다
      const { userId, oneTimeToken } = await signUpAndLogin();
      const imageUrl = '/uploads/profile/sample.webp';

      // When
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/profile/image`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ imageUrl });

      // Then
      expect(res.status).toBe(201);
      const rows = await dataSource.query(
        `SELECT image_path FROM user_profile_image WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].image_path).toBe(imageUrl);
    });

    it('정상 등록 시 201을 반환하고 DB에 imagePath가 저장된다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      await createProfile(oneTimeToken);

      const imageUrl = '/uploads/profile/new.webp';

      // When
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/profile/image`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ imageUrl });

      // Then - 테스트 환경에서 IMAGE_DOMAIN_NAME이 빈 문자열이라 path가 그대로 저장된다
      expect(res.status).toBe(201);
      const rows = await dataSource.query(
        `SELECT user_id, image_path FROM user_profile_image WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].image_path).toBe(imageUrl);
    });

    it('기존 이미지가 있으면 교체되어 단일 row만 유지된다', async () => {
      // Given - 프로필 + 첫 이미지 등록
      const { userId, oneTimeToken } = await signUpAndLogin();
      await createProfile(oneTimeToken);

      const firstImageUrl = '/uploads/profile/first.webp';
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile/image`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ imageUrl: firstImageUrl });

      // When - 두 번째 이미지로 다시 POST
      const secondImageUrl = '/uploads/profile/second.webp';
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/profile/image`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ imageUrl: secondImageUrl });

      // Then - row는 1개, 이미지 경로는 새 값으로 교체
      expect(res.status).toBe(201);
      const rows = await dataSource.query(
        `SELECT image_path FROM user_profile_image WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].image_path).toBe(secondImageUrl);
    });

    it('imageUrl이 누락되면 400을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      await createProfile(oneTimeToken);

      // When
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/profile/image`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({});

      // Then
      expect(res.status).toBe(400);
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/profile/image`)
        .send({ imageUrl: '/uploads/profile/x.webp' });

      // Then
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /user/profile/image
  // -------------------------------------------------------------------------
  describe('DELETE /user/profile/image', () => {
    it('이미지가 없으면 404를 반환한다', async () => {
      // Given - 프로필만 있고 이미지는 없음
      const { oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildProfileBody());

      // When
      const res = await request(app.getHttpServer())
        .delete(`${USER_BASE}/profile/image`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(404);
    });

    it('정상 삭제 시 200을 반환하고 DB row가 hard delete된다', async () => {
      // Given - 프로필 + 이미지 등록
      const { userId, oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildProfileBody());
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile/image`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ imageUrl: '/uploads/profile/to-delete.webp' });

      // When
      const res = await request(app.getHttpServer())
        .delete(`${USER_BASE}/profile/image`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then - soft delete가 아닌 hard delete이므로 row 자체가 사라져야 한다
      expect(res.status).toBe(200);
      const rows = await dataSource.query(
        `SELECT user_id FROM user_profile_image WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(0);
    });

    it('삭제 후 같은 사용자가 다시 POST하면 새 이미지가 정상 저장된다', async () => {
      // Given - 등록 → 삭제
      const { userId, oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildProfileBody());
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile/image`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ imageUrl: '/uploads/profile/v1.webp' });
      await request(app.getHttpServer())
        .delete(`${USER_BASE}/profile/image`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // When - 재등록
      const newUrl = '/uploads/profile/v2.webp';
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/profile/image`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ imageUrl: newUrl });

      // Then
      expect(res.status).toBe(201);
      const rows = await dataSource.query(
        `SELECT image_path FROM user_profile_image WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].image_path).toBe(newUrl);
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).delete(
        `${USER_BASE}/profile/image`,
      );

      // Then
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // POST /user/fit
  // -------------------------------------------------------------------------
  describe('POST /user/fit', () => {
    it('정상 생성 시 201을 반환하고 DB에 체형 정보가 저장된다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const body = buildFitBody();

      // When
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(body);

      // Then
      expect(res.status).toBe(201);
      const rows = await dataSource.query(
        `SELECT user_id, height, weight, shoe_size, outer_size, top_size,
                bottom_size, delete_date
         FROM user_fit WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].height).toBe(body.height);
      expect(rows[0].weight).toBe(body.weight);
      expect(rows[0].shoe_size).toBe(body.shoeSize);
      expect(rows[0].outer_size).toBe(body.outerSize);
      expect(rows[0].top_size).toBe(body.topSize);
      expect(rows[0].bottom_size).toBe(body.bottomSize);
      expect(rows[0].delete_date).toBeNull();
    });

    it('soft-deleted 상태에서 다시 POST하면 restore되어 활성화된다', async () => {
      // Given - 생성 → soft delete
      const { userId, oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildFitBody());
      await request(app.getHttpServer())
        .delete(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      const deletedRows = await dataSource.query(
        `SELECT delete_date FROM user_fit WHERE user_id = $1`,
        [userId],
      );
      expect(deletedRows[0].delete_date).not.toBeNull();

      // When - 다시 생성
      const newBody = buildFitBody({ height: 175, weight: 65 });
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(newBody);

      // Then - delete_date가 NULL로 복원되고 새로운 값으로 업데이트
      expect(res.status).toBe(201);
      const rows = await dataSource.query(
        `SELECT height, weight, delete_date FROM user_fit WHERE user_id = $1`,
        [userId],
      );
      expect(rows[0].delete_date).toBeNull();
      expect(rows[0].height).toBe(175);
      expect(rows[0].weight).toBe(65);
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/fit`)
        .send(buildFitBody());

      // Then
      expect(res.status).toBe(401);
    });

    it('일부 필드(height)가 누락되어도 201을 반환하고 누락 필드는 NULL로 저장된다', async () => {
      // Given - 모든 필드가 선택적이므로 height 없이 전송
      const { userId, oneTimeToken } = await signUpAndLogin();
      const body = buildFitBody();
      delete (body as Record<string, unknown>).height;

      // When
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(body);

      // Then
      expect(res.status).toBe(201);
      const rows = await dataSource.query(
        `SELECT height, weight FROM user_fit WHERE user_id = $1`,
        [userId],
      );
      expect(rows[0].height).toBeNull();
      expect(rows[0].weight).toBe(body.weight);
    });

    it('모든 필드가 비어있는 빈 바디로도 201을 반환하고 전부 NULL로 저장된다', async () => {
      // Given - 빈 바디 (모든 필드 선택적)
      const { userId, oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({});

      // Then
      expect(res.status).toBe(201);
      const rows = await dataSource.query(
        `SELECT height, weight, shoe_size, outer_size, top_size, bottom_size
         FROM user_fit WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].height).toBeNull();
      expect(rows[0].weight).toBeNull();
      expect(rows[0].shoe_size).toBeNull();
      expect(rows[0].outer_size).toBeNull();
      expect(rows[0].top_size).toBeNull();
      expect(rows[0].bottom_size).toBeNull();
    });

    it('선택적이어도 값이 잘못된 타입(height가 숫자 아님)이면 400을 반환한다', async () => {
      // Given - 필드는 선택적이지만 값이 있으면 타입 검증은 유지된다
      const { oneTimeToken } = await signUpAndLogin();
      const body = buildFitBody({ height: 'not-a-number' });

      // When
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(body);

      // Then
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /user/fit
  // -------------------------------------------------------------------------
  describe('PATCH /user/fit', () => {
    it('체형 정보가 없으면 404를 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildFitBody());

      // Then
      expect(res.status).toBe(404);
    });

    it('정상 수정 시 200을 반환하고 DB에 반영된다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildFitBody());

      const updated = buildFitBody({
        height: 170,
        weight: 60,
        topSize: 'L',
      });

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(updated);

      // Then
      expect(res.status).toBe(200);
      const rows = await dataSource.query(
        `SELECT height, weight, top_size FROM user_fit WHERE user_id = $1`,
        [userId],
      );
      expect(rows[0].height).toBe(170);
      expect(rows[0].weight).toBe(60);
      expect(rows[0].top_size).toBe('L');
    });

    it('일부 필드만 전송하면 200을 반환하고 해당 필드만 갱신된다', async () => {
      // Given - 전체 체형 정보 생성
      const { userId, oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildFitBody());

      // When - weight만 전송 (나머지 필드는 선택적이라 생략)
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ weight: 55 });

      // Then - weight만 갱신되고 나머지는 기존 값이 유지된다
      expect(res.status).toBe(200);
      const rows = await dataSource.query(
        `SELECT height, weight FROM user_fit WHERE user_id = $1`,
        [userId],
      );
      expect(rows[0].weight).toBe(55);
      expect(rows[0].height).toBe(180);
    });
  });

  // -------------------------------------------------------------------------
  // GET /user/fit
  // -------------------------------------------------------------------------
  describe('GET /user/fit', () => {
    it('체형 정보가 없으면 404를 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .get(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(404);
    });

    it('정상 조회 시 200과 체형 정보를 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const fitBody = buildFitBody();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(fitBody);

      // When
      const res = await request(app.getHttpServer())
        .get(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.result).toBe(true);
      expect(res.body.data.height).toBe(fitBody.height);
      expect(res.body.data.weight).toBe(fitBody.weight);
      expect(res.body.data.shoeSize).toBe(fitBody.shoeSize);
      expect(res.body.data.outerSize).toBe(fitBody.outerSize);
      expect(res.body.data.topSize).toBe(fitBody.topSize);
      expect(res.body.data.bottomSize).toBe(fitBody.bottomSize);
    });

    it('빈 바디로 생성된 체형 정보는 200과 함께 모든 필드를 null로 반환한다', async () => {
      // Given - 빈 바디로 생성 (모든 필드 선택적, GetUserFitResponse는 null 허용)
      const { oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({});

      // When
      const res = await request(app.getHttpServer())
        .get(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.result).toBe(true);
      expect(res.body.data.height).toBeNull();
      expect(res.body.data.weight).toBeNull();
      expect(res.body.data.shoeSize).toBeNull();
      expect(res.body.data.outerSize).toBeNull();
      expect(res.body.data.topSize).toBeNull();
      expect(res.body.data.bottomSize).toBeNull();
    });

    it('일부 필드만 생성된 경우 채워진 필드는 값, 나머지는 null로 반환한다', async () => {
      // Given - height/topSize만 채워서 생성
      const { oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({ height: 165, topSize: 'L' });

      // When
      const res = await request(app.getHttpServer())
        .get(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.height).toBe(165);
      expect(res.body.data.topSize).toBe('L');
      expect(res.body.data.weight).toBeNull();
      expect(res.body.data.shoeSize).toBeNull();
      expect(res.body.data.outerSize).toBeNull();
      expect(res.body.data.bottomSize).toBeNull();
    });

    it('soft-deleted 상태이면 404를 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildFitBody());
      await request(app.getHttpServer())
        .delete(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // When
      const res = await request(app.getHttpServer())
        .get(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /user/fit
  // -------------------------------------------------------------------------
  describe('DELETE /user/fit', () => {
    it('체형 정보가 없으면 404를 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .delete(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(404);
    });

    it('정상 삭제 시 200을 반환하고 delete_date가 설정된다 (soft delete)', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildFitBody());

      // When
      const res = await request(app.getHttpServer())
        .delete(`${USER_BASE}/fit`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(200);
      const rows = await dataSource.query(
        `SELECT delete_date FROM user_fit WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].delete_date).not.toBeNull();
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer()).delete(`${USER_BASE}/fit`);

      // Then
      expect(res.status).toBe(401);
    });
  });
});

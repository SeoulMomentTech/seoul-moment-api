import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { UserProfileGender } from '../libs/repository/src/enum/user-profile.enum';

const USER_AUTH_BASE = '/user/auth';
const USER_BASE = '/user';

function buildSignUpBody(overrides?: Record<string, unknown>) {
  return {
    email: faker.internet.email().toLowerCase(),
    password: faker.internet.password({ length: 12 }),
    phone: faker.string.numeric(11),
    personalInfoAgreeDate: '2025-01-01 12:00:00',
    ...overrides,
  };
}

function buildProfileBody(overrides?: Record<string, unknown>) {
  return {
    profileImageUrl: faker.image.url(),
    nickname: faker.person.firstName(),
    name: faker.person.fullName(),
    gender: UserProfileGender.MALE,
    birthDate: '1990-01-01',
    postalCode: '12345',
    city: '서울',
    district: '강남구',
    detailAddress: faker.location.streetAddress(),
    visibility: true,
    ...overrides,
  };
}

function buildFitBody(overrides?: Record<string, unknown>) {
  return {
    height: 180,
    weight: 70,
    shoeSize: 270,
    outerSize: 'M',
    topSize: 'M',
    bottomSize: '32',
    isSensitiveDataAgreed: true,
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
      oneTimeToken: loginRes.body.data.token as string,
    };
  }

  // -------------------------------------------------------------------------
  // GET /user/info
  // -------------------------------------------------------------------------
  describe('GET /user/info', () => {
    it('정상 조회 시 200과 유저 정보를 반환한다', async () => {
      // Given
      const { email, oneTimeToken } = await signUpAndLogin({
        adAgreeEmailDate: '2025-02-03 04:05:06',
        recommendEmailDate: null,
        recommendPhoneDate: null,
      });

      // When
      const res = await request(app.getHttpServer())
        .get(`${USER_BASE}/info`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.result).toBe(true);
      expect(res.body.data.email).toBe(email);
      expect(typeof res.body.data.phone).toBe('string');
      expect(res.body.data.adAgreeEmail).toBe(true);
      expect(res.body.data.recommendEmail).toBe(false);
      expect(res.body.data.recommendPhone).toBe(false);
      expect(res.body.data.personalInfoAgree).toBe(true);
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
    it('정상 수정 시 200을 반환하고 DB에 반영된다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const newPhone = faker.string.numeric(11);
      const newEmail = faker.internet.email().toLowerCase();

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/info`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({
          phone: newPhone,
          email: newEmail,
          adAgreeEmail: true,
          recommendEmail: true,
          recommendPhone: true,
          personalInfoAgree: true,
        });

      // Then
      expect(res.status).toBe(200);
      const rows = await dataSource.query(
        `SELECT phone, email, ad_agree_email_date, recommend_email_date,
                recommend_phone_date, personal_info_agree_date
         FROM "user" WHERE id = $1`,
        [userId],
      );
      expect(rows[0].phone).toBe(newPhone);
      expect(rows[0].email).toBe(newEmail);
      expect(rows[0].ad_agree_email_date).toBeInstanceOf(Date);
      expect(rows[0].recommend_email_date).toBeInstanceOf(Date);
      expect(rows[0].recommend_phone_date).toBeInstanceOf(Date);
      expect(rows[0].personal_info_agree_date).toBeInstanceOf(Date);
    });

    it('동의 boolean이 false면 해당 컬럼이 NULL로 저장된다', async () => {
      // Given - 가입 시 모든 동의 컬럼을 채움
      const { userId, oneTimeToken } = await signUpAndLogin({
        adAgreeEmailDate: '2025-02-03 04:05:06',
        recommendEmailDate: '2025-02-03 04:05:06',
        recommendPhoneDate: '2025-02-03 04:05:06',
      });

      // When - 모두 false로 PATCH
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/info`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({
          email: faker.internet.email().toLowerCase(),
          adAgreeEmail: false,
          recommendEmail: false,
          recommendPhone: false,
          personalInfoAgree: false,
        });

      // Then
      expect(res.status).toBe(200);
      const rows = await dataSource.query(
        `SELECT ad_agree_email_date, recommend_email_date,
                recommend_phone_date, personal_info_agree_date
         FROM "user" WHERE id = $1`,
        [userId],
      );
      expect(rows[0].ad_agree_email_date).toBeNull();
      expect(rows[0].recommend_email_date).toBeNull();
      expect(rows[0].recommend_phone_date).toBeNull();
      expect(rows[0].personal_info_agree_date).toBeNull();
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/info`)
        .send({
          email: faker.internet.email().toLowerCase(),
          adAgreeEmail: true,
          recommendEmail: true,
          recommendPhone: true,
          personalInfoAgree: true,
        });

      // Then
      expect(res.status).toBe(401);
    });

    it('email이 누락되면 400을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/info`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send({
          adAgreeEmail: true,
          recommendEmail: true,
          recommendPhone: true,
          personalInfoAgree: true,
        });

      // Then
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // POST /user/profile
  // -------------------------------------------------------------------------
  describe('POST /user/profile', () => {
    it('정상 생성 시 201을 반환하고 DB에 프로필이 저장된다', async () => {
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
      const rows = await dataSource.query(
        `SELECT user_id, nickname, image_path, name, gender, birth_date,
                postal_code, city, district, detail_address, visibility
         FROM user_profile WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].nickname).toBe(body.nickname);
      expect(rows[0].image_path).toBe(body.profileImageUrl);
      expect(rows[0].name).toBe(body.name);
      expect(rows[0].gender).toBe(body.gender);
      expect(rows[0].postal_code).toBe(body.postalCode);
      expect(rows[0].city).toBe(body.city);
      expect(rows[0].district).toBe(body.district);
      expect(rows[0].detail_address).toBe(body.detailAddress);
      expect(rows[0].visibility).toBe(body.visibility);
    });

    it('profileImageUrl과 nickname을 생략해도 생성된다', async () => {
      // Given
      const { userId, oneTimeToken } = await signUpAndLogin();
      const body = buildProfileBody();
      delete (body as Record<string, unknown>).profileImageUrl;
      delete (body as Record<string, unknown>).nickname;

      // When
      const res = await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(body);

      // Then
      expect(res.status).toBe(201);
      const rows = await dataSource.query(
        `SELECT nickname, image_path FROM user_profile WHERE user_id = $1`,
        [userId],
      );
      expect(rows[0].nickname).toBeNull();
      expect(rows[0].image_path).toBeNull();
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
        .send(buildProfileBody());

      // Then
      expect(res.status).toBe(404);
    });

    it('정상 수정 시 200을 반환하고 DB에 반영된다', async () => {
      // Given - 먼저 프로필 생성
      const { userId, oneTimeToken } = await signUpAndLogin();
      await request(app.getHttpServer())
        .post(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(buildProfileBody());

      const updated = buildProfileBody({
        name: '변경된이름',
        city: '부산',
        visibility: false,
      });

      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`)
        .send(updated);

      // Then
      expect(res.status).toBe(200);
      const rows = await dataSource.query(
        `SELECT name, city, visibility FROM user_profile WHERE user_id = $1`,
        [userId],
      );
      expect(rows[0].name).toBe('변경된이름');
      expect(rows[0].city).toBe('부산');
      expect(rows[0].visibility).toBe(false);
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
      // When
      const res = await request(app.getHttpServer())
        .patch(`${USER_BASE}/profile`)
        .send(buildProfileBody());

      // Then
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // GET /user/profile
  // -------------------------------------------------------------------------
  describe('GET /user/profile', () => {
    it('프로필이 없으면 404를 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();

      // When
      const res = await request(app.getHttpServer())
        .get(`${USER_BASE}/profile`)
        .set('Authorization', `Bearer ${oneTimeToken}`);

      // Then
      expect(res.status).toBe(404);
    });

    it('정상 조회 시 200과 프로필 정보를 반환한다', async () => {
      // Given
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
      expect(res.body.data.profileImageUrl).toBe(profileBody.profileImageUrl);
      expect(res.body.data.nickname).toBe(profileBody.nickname);
      expect(res.body.data.name).toBe(profileBody.name);
      expect(res.body.data.gender).toBe(profileBody.gender);
      expect(res.body.data.birthDate).toBe(profileBody.birthDate);
      expect(res.body.data.postalCode).toBe(profileBody.postalCode);
      expect(res.body.data.city).toBe(profileBody.city);
      expect(res.body.data.district).toBe(profileBody.district);
      expect(res.body.data.detailAddress).toBe(profileBody.detailAddress);
      expect(res.body.data.visibility).toBe(profileBody.visibility);
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
                bottom_size, is_sensitive_data_agreed, delete_date
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
      expect(rows[0].is_sensitive_data_agreed).toBe(body.isSensitiveDataAgreed);
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

    it('필수 필드(height)가 누락되면 400을 반환한다', async () => {
      // Given
      const { oneTimeToken } = await signUpAndLogin();
      const body = buildFitBody();
      delete (body as Record<string, unknown>).height;

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
      expect(res.body.data.isSensitiveDataAgreed).toBe(
        fitBody.isSensitiveDataAgreed,
      );
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

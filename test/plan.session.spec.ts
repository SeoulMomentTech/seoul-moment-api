import { JwtType } from '@app/auth/auth.dto';
import { Configuration } from '@app/config/configuration';
import { KakaoService } from '@app/external/kakao/kakao.service';
import {
  PlanUserStatus,
  PlatformType,
} from '@app/repository/enum/plan-user.enum';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { PlanUserService } from 'apps/api/src/module/plen/user/plan-user.service';
import { plainToInstance } from 'class-transformer';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { PlanUserEntity } from '../libs/repository/src/entity/plan-user.entity';

/**
 * 로그인 세션이 우리 JWT 하나로 서는지 확인한다.
 *
 * 예전에는 로그인 때 받은 **카카오 access_token 을 JWT payload 에 넣고 매 요청
 * 카카오 서버에 물었다.** 우리 JWT 는 100년짜리였지만 카카오 토큰 수명이
 * 6시간이라 실효 세션도 6시간이었다 — 탭을 닫지 않아도 점심 먹고 오면 끊겼다.
 *
 * 가드는 여태 테스트가 하나도 없었다(다른 plan 스펙은 서비스를 직접 부른다).
 * 그래서 이 스펙만 HTTP 로 `PlanApiGuard` 를 실제로 통과시킨다.
 */
describe('Plan session (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let kakaoService: KakaoService;
  let planUserService: PlanUserService;

  const SECRET = Configuration.getConfig().JWT_SECRET;

  beforeAll(async () => {
    app = await getTestApp();
    dataSource = getDataSource(app);
    kakaoService = app.get(KakaoService);
    planUserService = app.get(PlanUserService);
  }, 60_000);

  afterEach(async () => {
    jest.restoreAllMocks();
    await truncateTables(dataSource, ['plan_user']);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // -------------------------------------------------------------------------
  // 헬퍼
  // -------------------------------------------------------------------------
  async function createPlanUser(
    override: Partial<PlanUserEntity> = {},
  ): Promise<PlanUserEntity> {
    return dataSource.getRepository(PlanUserEntity).save(
      plainToInstance(PlanUserEntity, {
        name: faker.person.firstName(),
        roomShareCode: faker.string.uuid(),
        kakaoId: faker.number.int({ min: 1, max: 9999999 }),
        budget: 4200,
        ...override,
      }),
    );
  }

  /** 지금 발급되는 모양의 토큰 (카카오 토큰 없음) */
  function signToken(
    planUser: PlanUserEntity,
    options: jwt.SignOptions = {},
  ): string {
    return jwt.sign(
      {
        platformType: PlatformType.KAKAO,
        planUserId: planUser.id,
        kakaoId: planUser.kakaoId,
        tokenVersion: planUser.tokenVersion ?? 0,
        jwtType: JwtType.ONE_TIME_TOKEN,
      },
      SECRET,
      { expiresIn: '180d', ...options },
    );
  }

  function getPlanUser(token: string) {
    return request(app.getHttpServer())
      .get('/plan/user')
      .set('Authorization', `Bearer ${token}`);
  }

  async function reload(id: string): Promise<PlanUserEntity> {
    return dataSource.getRepository(PlanUserEntity).findOneByOrFail({ id });
  }

  // -------------------------------------------------------------------------
  describe('카카오에 매달리지 않는다', () => {
    it('요청을 처리하면서 카카오 서버를 부르지 않는다', async () => {
      // Given
      const planUser = await createPlanUser();
      const validateToken = jest.spyOn(kakaoService, 'validateToken');

      // When
      const res = await getPlanUser(signToken(planUser));

      // Then
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe(planUser.name);
      // 이 기대가 깨지면 로그인 상태가 다시 카카오 토큰 수명(6시간)에 묶인 것이다
      expect(validateToken).not.toHaveBeenCalled();
    });

    it('로그인이 내주는 토큰에 카카오 access_token 이 들어 있지 않다', async () => {
      // Given - 카카오만 흉내 내고 나머지는 실제 로그인 경로를 그대로 탄다
      const kakaoId = faker.number.int({ min: 1, max: 9999999 });
      jest
        .spyOn(kakaoService, 'validateToken')
        .mockResolvedValue({ id: kakaoId } as any);
      jest.spyOn(kakaoService, 'getUserInfo').mockResolvedValue({
        kakao_account: { email: faker.internet.email() },
      } as any);

      // When
      const res = await request(app.getHttpServer())
        .post('/plan/auth/kakao/login')
        .send({ kakaoToken: 'kakao-access-token-should-not-leak' });

      // Then
      expect(res.status).toBe(200);
      const payload = jwt.decode(res.body.data.token) as Record<string, any>;
      // JWT payload 는 base64 라 누구나 꺼내 읽는다. 카카오 토큰을 실으면
      // 그걸 주운 사람이 카카오 API 를 직접 부를 수 있다.
      expect(payload.kakaoToken).toBeUndefined();
      expect(payload.planUserId).toEqual(expect.any(String));
      expect(payload.tokenVersion).toBe(0);
    });

    it('세션은 180일짜리다 (예전 100년이 아니다)', async () => {
      // Given
      jest
        .spyOn(kakaoService, 'validateToken')
        .mockResolvedValue({ id: 1234 } as any);
      jest.spyOn(kakaoService, 'getUserInfo').mockResolvedValue({
        kakao_account: { email: 'a@b.c' },
      } as any);

      // When
      const res = await request(app.getHttpServer())
        .post('/plan/auth/kakao/login')
        .send({ kakaoToken: 'kakao-token' });

      // Then
      const { iat, exp } = jwt.decode(res.body.data.token) as {
        iat: number;
        exp: number;
      };
      expect(exp - iat).toBe(180 * 24 * 60 * 60);
    });
  });

  describe('예전에 발급한 토큰', () => {
    it('kakaoToken 이 박혀 있고 tokenVersion 이 없어도 그대로 통과한다', async () => {
      // Given - 이번 변경 전에 나간 토큰. 배포로 기존 사용자를 로그아웃시키면 안 된다
      const planUser = await createPlanUser();
      const legacyToken = jwt.sign(
        {
          platformType: PlatformType.KAKAO,
          planUserId: planUser.id,
          kakaoId: planUser.kakaoId,
          kakaoToken: 'expired-kakao-access-token',
          jwtType: JwtType.ONE_TIME_TOKEN,
        },
        SECRET,
        { expiresIn: '36500d' },
      );

      // When
      const res = await getPlanUser(legacyToken);

      // Then - 안에 든 카카오 토큰이 이미 죽었어도 상관없다
      expect(res.status).toBe(200);
    });
  });

  describe('거절해야 하는 토큰', () => {
    it('만료된 토큰은 401', async () => {
      const planUser = await createPlanUser();

      const res = await getPlanUser(signToken(planUser, { expiresIn: '-1s' }));

      expect(res.status).toBe(401);
    });

    it('다른 용도로 발급된 토큰은 401', async () => {
      // Given - 가입·SNS 연동 토큰도 같은 JWT_SECRET 으로 서명된다
      const planUser = await createPlanUser();
      const token = jwt.sign(
        {
          platformType: PlatformType.KAKAO,
          planUserId: planUser.id,
          jwtType: JwtType.SNS_SIGNUP_TOKEN,
        },
        SECRET,
        { expiresIn: '10m' },
      );

      const res = await getPlanUser(token);

      expect(res.status).toBe(401);
    });

    it('서명이 다르면 401', async () => {
      const planUser = await createPlanUser();
      const token = jwt.sign(
        { planUserId: planUser.id, jwtType: JwtType.ONE_TIME_TOKEN },
        'not-our-secret',
        { expiresIn: '180d' },
      );

      const res = await getPlanUser(token);

      expect(res.status).toBe(401);
    });

    it('Authorization 헤더가 없으면 401', async () => {
      const res = await request(app.getHttpServer()).get('/plan/user');

      expect(res.status).toBe(401);
    });

    it('차단된 사용자는 401', async () => {
      const planUser = await createPlanUser({ status: PlanUserStatus.BLOCK });

      const res = await getPlanUser(signToken(planUser));

      expect(res.status).toBe(401);
    });

    it('탈퇴한 사용자의 토큰은 401', async () => {
      // Given
      const planUser = await createPlanUser();
      const token = signToken(planUser);
      expect((await getPlanUser(token)).status).toBe(200);

      // When
      await planUserService.deletePlanUser(planUser.id);

      // Then
      expect((await getPlanUser(token)).status).toBe(401);
    });
  });

  describe('토큰 회수 (모든 기기에서 로그아웃)', () => {
    it('세대를 올리면 이미 나간 토큰이 즉시 죽는다', async () => {
      // Given
      const planUser = await createPlanUser();
      const token = signToken(planUser);
      expect((await getPlanUser(token)).status).toBe(200);

      // When
      const logout = await request(app.getHttpServer())
        .post('/plan/auth/logout/all')
        .set('Authorization', `Bearer ${token}`);

      // Then
      expect(logout.status).toBe(201);
      expect((await reload(planUser.id)).tokenVersion).toBe(1);
      expect((await getPlanUser(token)).status).toBe(401);
    });

    it('회수 뒤 다시 로그인하면 새 세대의 토큰으로 통한다', async () => {
      // Given
      const planUser = await createPlanUser({ tokenVersion: 3 });

      // When - 로그인은 지금 세대를 실어 준다
      const fresh = signToken(await reload(planUser.id));

      // Then
      expect((await getPlanUser(fresh)).status).toBe(200);
    });
  });

  describe('마지막 접속 일시', () => {
    it('날이 바뀌면 갱신한다', async () => {
      // Given
      const planUser = await createPlanUser({
        lastLoginDate: new Date('2026-01-01T00:00:00.000Z'),
      });
      const before = (await reload(planUser.id)).lastLoginDate;

      // When
      expect((await getPlanUser(signToken(planUser))).status).toBe(200);

      // Then
      const after = await reload(planUser.id);
      expect(after.lastLoginDate.getTime()).not.toBe(before.getTime());
    });

    it('같은 날 안에서는 다시 쓰지 않는다', async () => {
      // Given - 예전에는 요청마다 UPDATE 가 나갔다. 화면 하나 여는 데 쓰기가 여러 번 붙는다
      const planUser = await createPlanUser({ lastLoginDate: new Date() });
      // 저장·조회를 한 번 왕복시킨 값과 비교한다. 이 컬럼은 타임존 없는
      // timestamp 라 왕복하면서 값이 그대로 돌아오지 않는다 (가드 주석 참고)
      const before = (await reload(planUser.id)).lastLoginDate;
      const token = signToken(planUser);

      // When
      await getPlanUser(token);
      await getPlanUser(token);

      // Then
      const after = await reload(planUser.id);
      expect(after.lastLoginDate.getTime()).toBe(before.getTime());
    });
  });
});

import { JwtType } from '@app/auth/auth.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Configuration } from '@app/config/configuration';
import { ChatRoomMemberEntity } from '@app/repository/entity/chat-room-member.entity';
import { ChatRoomEntity } from '@app/repository/entity/chat-room.entity';
import { PlanScheduleEntity } from '@app/repository/entity/plan-schedule.entity';
import { PlanUserCategoryEntity } from '@app/repository/entity/plan-user-category.entity';
import { PlanUserRoomMemberEntity } from '@app/repository/entity/plan-user-room-member.entity';
import { PlanUserEntity } from '@app/repository/entity/plan-user.entity';
import { PlanSchedulePayType } from '@app/repository/enum/plan-schedule.enum';
import { PlanUserRoomMemberPermission } from '@app/repository/enum/plan-user-room-member.enum';
import { PlatformType } from '@app/repository/enum/plan-user.enum';
import { PlanScheduleRepositoryService } from '@app/repository/service/plan-schedule.repository.service';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { PlanRoomService } from 'apps/api/src/module/plen/room/plan-room.service';
import { PostPlanScheduleRequest } from 'apps/api/src/module/plen/schedule/plan-schedule.dto';
import { PlanScheduleService } from 'apps/api/src/module/plen/schedule/plan-schedule.service';
import { PlanUserService } from 'apps/api/src/module/plen/user/plan-user.service';
import { plainToInstance } from 'class-transformer';
import { readFileSync } from 'fs';
import jwt from 'jsonwebtoken';
import { join } from 'path';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';

describe('A/B 모바일 공동 플랜 회귀 (실제 DB와 인증 가드)', () => {
  let app: INestApplication;
  let db: DataSource;
  let rooms: PlanRoomService;
  let schedules: PlanScheduleService;
  let users: PlanUserService;

  beforeAll(async () => {
    app = await getTestApp();
    db = getDataSource(app);
    rooms = app.get(PlanRoomService);
    schedules = app.get(PlanScheduleService);
    users = app.get(PlanUserService);
  }, 60_000);
  afterEach(async () => truncateTables(db, ['plan_user']));
  afterAll(async () => closeTestApp());

  async function user() {
    return db.getRepository(PlanUserEntity).save(
      plainToInstance(PlanUserEntity, {
        name: faker.person.firstName(),
        roomShareCode: faker.string.uuid(),
        budget: 3000,
        weddingDate: '2026-09-15',
      }),
    );
  }
  function token(u: PlanUserEntity) {
    return jwt.sign(
      {
        planUserId: u.id,
        platformType: PlatformType.KAKAO,
        tokenVersion: 0,
        jwtType: JwtType.ONE_TIME_TOKEN,
      },
      Configuration.getConfig().JWT_SECRET,
      { expiresIn: '1h' },
    );
  }
  function get(u: PlanUserEntity, path: string) {
    return request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token(u)}`);
  }
  const body = (
    title: string,
    amount = 100,
    roomId?: number,
  ): PostPlanScheduleRequest => ({
    title,
    amount,
    roomId,
    categoryName: '웨딩홀',
    payType: PlanSchedulePayType.CREDIT,
    startDate: '2026-09-15',
  });
  async function couple() {
    const a = await user();
    const b = await user();
    await rooms.postPlanRoom(b.id, a.roomShareCode, true);
    const membership = await db
      .getRepository(PlanUserRoomMemberEntity)
      .findOneByOrFail({
        planUserId: b.id,
        permission: PlanUserRoomMemberPermission.SPOUSE,
      });
    return { a, b, roomId: membership.roomId };
  }

  it.each([false, true])(
    '상태만 보낸 완료 요청은 결제 상태 %s를 보존한다',
    async (isPaid) => {
      const { a, b } = await couple();
      const created = await schedules.postPlanSchedule(a.id, {
        ...body('상태 전환'),
        isPaid,
      });
      const response = await request(app.getHttpServer())
        .patch(`/plan/schedule/status/${created.id}`)
        .set('Authorization', `Bearer ${token(b)}`)
        .send({ status: 'COMPLETED' })
        .expect(200);
      expect(response.body.data).toMatchObject({ status: 'COMPLETED', isPaid });
      const saved = await db
        .getRepository(PlanScheduleEntity)
        .findOneByOrFail({ id: created.id });
      expect(saved.status).toBe('COMPLETED');
      expect(saved.isPaid).toBe(isPaid);
    },
  );

  it('자랑하기 합계는 배우자가 작성한 공동 일정도 포함한다', async () => {
    const { a, b, roomId } = await couple();
    await schedules.postPlanSchedule(a.id, {
      ...body('방장 일정', 100),
      isPaid: true,
    });
    await schedules.postPlanSchedule(b.id, {
      ...body('배우자 일정', 200, roomId),
      isPaid: false,
    });
    const rows = await app
      .get(PlanScheduleRepositoryService)
      .getBragTotals([a.id, b.id]);
    expect(rows).toEqual([
      expect.objectContaining({
        planUserId: a.id,
        usedAmount: 100,
        plannedAmount: 200,
        total: 2,
      }),
    ]);
  });

  it('추가 채팅방 정보는 채팅방 ID와 다른 실제 플랜 방 ID를 제공한다', async () => {
    const { a, b, roomId } = await couple();
    const chat = await db
      .getRepository(ChatRoomEntity)
      .save({ name: '추가 채팅', planUserRoomId: roomId });
    await db.getRepository(ChatRoomMemberEntity).save([
      { chatRoomId: chat.id, planUserId: a.id },
      { chatRoomId: chat.id, planUserId: b.id },
    ]);
    expect(chat.id).not.toBe(roomId);
    const response = await get(b, `/plan/chat/info/${chat.id}`).expect(200);
    expect(response.body.data).toMatchObject({
      id: chat.id,
      planUserRoomId: roomId,
    });
  });

  it('날짜만 옮기는 HTTP PATCH는 제목·금액·메모·결제를 보존한다', async () => {
    const { a, b } = await couple();
    const created = await schedules.postPlanSchedule(a.id, {
      ...body('드래그 일정', 200),
      isPaid: true,
      memo: '보존 메모',
      startTime: '14:30',
    });
    await request(app.getHttpServer())
      .patch(`/plan/schedule/${created.id}`)
      .set('Authorization', `Bearer ${token(b)}`)
      .send({ startDate: '2026-10-15' })
      .expect(200);
    const response = await get(a, `/plan/schedule/${created.id}`).expect(200);
    expect(response.body.data).toMatchObject({
      title: '드래그 일정',
      amount: 200,
      isPaid: true,
      memo: '보존 메모',
      startTime: '14:30',
    });
    expect(String(response.body.data.startDate)).toContain('2026-10-15');
  });

  it('선택적인 PATCH 필드도 null을 명시하면 필수 값 삭제를 거절한다', async () => {
    const { a } = await couple();
    const created = await schedules.postPlanSchedule(a.id, body('보존 제목'));
    await request(app.getHttpServer())
      .patch(`/plan/schedule/${created.id}`)
      .set('Authorization', `Bearer ${token(a)}`)
      .send({ title: null })
      .expect(400);
    const saved = await db
      .getRepository(PlanScheduleEntity)
      .findOneByOrFail({ id: created.id });
    expect(saved.title).toBe('보존 제목');
  });

  it('인증 가드가 방 relation을 안 읽어도 /plan/user는 방 ID를 응답한다', async () => {
    // Given - 실제 모바일 로그인 이후 요청과 동일한 JWT 경로
    const { a, roomId } = await couple();
    // When
    const response = await get(a, '/plan/user').expect(200);
    // Then
    expect(response.body.data.roomId).toBe(roomId);
    expect(response.body.data.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ planUserId: a.id, permission: 'OWNER' }),
      ]),
    );
  });

  it('공유 후 방 ID 없이 만든 A 일정도 B의 목록과 상세에 표시된다', async () => {
    // Given
    const { a, b, roomId } = await couple();
    // When - 이전 프론트와 같은 POST 본문
    const created = await request(app.getHttpServer())
      .post('/plan/schedule')
      .set('Authorization', `Bearer ${token(a)}`)
      .send(body('A가 홈에서 추가'))
      .expect(200);
    // Then
    const list = await get(
      b,
      `/plan/schedule/room/${roomId}/list?page=1&count=100`,
    ).expect(200);
    expect(list.body.data.list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.body.data.id }),
      ]),
    );
    await get(b, `/plan/schedule/${created.body.data.id}`).expect(200);
  });

  it('B가 만든 공동 일정도 A의 기본 목록·달력·예산에 포함된다', async () => {
    // Given
    const { a, b, roomId } = await couple();
    await schedules.postPlanSchedule(a.id, body('A 일정', 100));
    await schedules.postPlanSchedule(b.id, body('B 일정', 200, roomId));
    // When
    const list = await get(a, '/plan/schedule/list?page=1&count=100').expect(
      200,
    );
    const calendar = await get(
      a,
      '/plan/schedule/calendar?year=2026&month=9',
    ).expect(200);
    const roomCalendar = await get(
      b,
      `/plan/schedule/calendar?year=2026&month=9&roomId=${roomId}`,
    ).expect(200);
    const total = await get(a, '/plan/user/total-amount').expect(200);
    // Then
    expect(list.body.data.list).toHaveLength(2);
    expect(calendar.body.data.list[0].list).toHaveLength(2);
    expect(roomCalendar.body.data.list[0].list).toHaveLength(2);
    expect(total.body.data.remainingAmount).toBe(2700);
    expect((await users.getPlanUserAmount(a)).plannedUseAmount).toBe(300);
    expect(
      (await users.getPlanUserCategoryChartList(a.id, '웨딩홀'))[0].totalAmount,
    ).toBe(300);
  });

  it('READ 재참여자가 배우자 링크를 수락하면 승격되고 채팅방은 중복 생성되지 않는다', async () => {
    // Given
    const a = await user();
    const b = await user();
    await rooms.postPlanRoom(b.id, a.roomShareCode);
    const before = await users.getUserChatRoomList(a.id);
    // When - 실제 초대 수락 HTTP 요청을 두 번 반복
    for (let i = 0; i < 2; i += 1) {
      await request(app.getHttpServer())
        .post(`/plan/room/${a.roomShareCode}?as=spouse`)
        .set('Authorization', `Bearer ${token(b)}`)
        .expect(201);
    }
    // Then
    const members = await users.getPlanUserRoomMemberListByUserId(a.id);
    expect(members.find((m) => m.planUserId === b.id)?.permission).toBe(
      'SPOUSE',
    );
    expect(await users.getUserChatRoomList(a.id)).toHaveLength(before.length);
    expect(
      await db
        .getRepository(PlanUserRoomMemberEntity)
        .countBy({ planUserId: a.id }),
    ).toBe(1);
  });

  it('여러 방에 속한 사람도 조회 중인 방의 권한을 받는다', async () => {
    // Given - B는 자기 방에서는 OWNER, A의 방에서는 SPOUSE
    const b = await user();
    const advisor = await user();
    const a = await user();
    await rooms.postPlanRoom(advisor.id, b.roomShareCode);
    await rooms.postPlanRoom(b.id, a.roomShareCode, true);
    // When
    const aInfo = await get(a, '/plan/user').expect(200);
    const bInfo = await get(b, '/plan/user').expect(200);
    const roomInfo = await get(
      b,
      `/plan/room/${aInfo.body.data.roomId}`,
    ).expect(200);
    // Then
    expect(
      roomInfo.body.data.members.find(
        (m: { planUserId: string }) => m.planUserId === b.id,
      ).permission,
    ).toBe('SPOUSE');
    expect(
      bInfo.body.data.members.find(
        (m: { planUserId: string }) => m.planUserId === b.id,
      ).permission,
    ).toBe('OWNER');
  });

  it('배우자는 A의 일정을 수정할 수 있고 READ로 내려가면 자기 공동 일정도 수정할 수 없다', async () => {
    // Given
    const { a, b, roomId } = await couple();
    const aSchedule = await schedules.postPlanSchedule(a.id, body('A 일정'));
    const bSchedule = await schedules.postPlanSchedule(
      b.id,
      body('B 일정', 200, roomId),
    );
    // When / Then
    await schedules.patchPlanSchedule(
      aSchedule.id,
      { ...body('A 일정'), memo: 'B 수정' },
      b.id,
    );
    expect(
      (await schedules.getPlanScheduleDetail(aSchedule.id, a.id)).memo,
    ).toBe('B 수정');
    await rooms.patchPlanRoomSpouse(a.id, null);
    await expect(
      schedules.patchPlanSchedule(
        bSchedule.id,
        { ...body('B 일정', 200, roomId), memo: '금지' },
        b.id,
      ),
    ).rejects.toBeInstanceOf(ServiceError);
    expect(
      (await schedules.getPlanScheduleDetail(bSchedule.id, b.id)).title,
    ).toBe('B 일정');
  });

  it('외부인은 공동 방의 목록·달력을 조회할 수 없다', async () => {
    // Given
    const { a, roomId } = await couple();
    const outsider = await user();
    await schedules.postPlanSchedule(a.id, body('비공개 일정'));
    // When / Then
    const list = await get(
      outsider,
      `/plan/schedule/room/${roomId}/list?page=1&count=100`,
    );
    const calendar = await get(
      outsider,
      `/plan/schedule/calendar?year=2026&month=9&roomId=${roomId}`,
    );
    expect(list.status).toBe(404);
    expect(calendar.status).toBe(404);
  });

  it('복구 SQL은 방장의 NULL 일정만 연결하고 다른 방/배우자의 개인 일정은 보존한다', async () => {
    // Given - 이전 버전이 공유 이후 NULL로 남긴 일정
    const { a, b, roomId } = await couple();
    const legacy = await db.getRepository(PlanScheduleEntity).save(
      plainToInstance(PlanScheduleEntity, {
        ...body('이전 A 일정'),
        planUserId: a.id,
      }),
    );
    const privateB = await schedules.postPlanSchedule(
      b.id,
      body('B 개인 일정'),
    );
    const elsewhereOwner = await user();
    await rooms.postPlanRoom(a.id, elsewhereOwner.roomShareCode, true);
    const elsewhere = await users.getPlanUser(elsewhereOwner);
    const otherSchedule = await schedules.postPlanSchedule(
      a.id,
      body('다른 방 일정', 500, elsewhere.roomId),
    );
    const category = await db.getRepository(PlanUserCategoryEntity).save(
      plainToInstance(PlanUserCategoryEntity, {
        planUserId: a.id,
        name: '복구 카테고리',
      }),
    );
    // When - 배포용 SQL을 반복 실행
    const sql = readFileSync(
      join(__dirname, '../docs/migrations/2026-09-15-plan-room-scope.sql'),
      'utf8',
    );
    await db.query(sql);
    await db.query(sql);
    // Then
    expect(
      (
        await db
          .getRepository(PlanScheduleEntity)
          .findOneByOrFail({ id: legacy.id })
      ).planUserRoomId,
    ).toBe(roomId);
    expect(
      (
        await db
          .getRepository(PlanScheduleEntity)
          .findOneByOrFail({ id: privateB.id })
      ).planUserRoomId,
    ).toBeNull();
    expect(
      (
        await db
          .getRepository(PlanScheduleEntity)
          .findOneByOrFail({ id: otherSchedule.id })
      ).planUserRoomId,
    ).toBe(elsewhere.roomId);
    expect(
      (
        await db
          .getRepository(PlanUserCategoryEntity)
          .findOneByOrFail({ id: category.id })
      ).planUserRoomId,
    ).toBe(roomId);
  });
});

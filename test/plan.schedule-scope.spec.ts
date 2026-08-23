import { PlanSchedulePayType } from '@app/repository/enum/plan-schedule.enum';
import { PlanUserRoomMemberPermission } from '@app/repository/enum/plan-user-room-member.enum';
import { PlanScheduleRepositoryService } from '@app/repository/service/plan-schedule.repository.service';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { PlanScheduleService } from 'apps/api/src/module/plen/schedule/plan-schedule.service';
import { PlanUserService } from 'apps/api/src/module/plen/user/plan-user.service';
import { plainToInstance } from 'class-transformer';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { PlanUserRoomMemberEntity } from '../libs/repository/src/entity/plan-user-room-member.entity';
import { PlanUserRoomEntity } from '../libs/repository/src/entity/plan-user-room.entity';
import { PlanUserEntity } from '../libs/repository/src/entity/plan-user.entity';

/**
 * "내 플랜" 의 범위가 화면마다 같은지.
 *
 * 예전에는 목록·캘린더·금액이 각자 다른 규칙을 써서, 같은 일정이 보드에는
 * 보이는데 달력에는 없고 예산에는 안 세어지는 일이 실제로 있었다.
 * 가입할 때 방이 하나 생기고 앱이 일정을 거기 붙이기 때문에 개인(NULL)만
 * 보는 화면은 사실상 빈 화면이 된다.
 */
describe('일정 범위 — 목록·캘린더·금액이 같은 것을 본다 (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let scheduleService: PlanScheduleService;
  let userService: PlanUserService;
  let scheduleRepo: PlanScheduleRepositoryService;

  beforeAll(async () => {
    app = await getTestApp();
    dataSource = getDataSource(app);
    scheduleService = app.get(PlanScheduleService);
    userService = app.get(PlanUserService);
    scheduleRepo = app.get(PlanScheduleRepositoryService);
  }, 60_000);

  afterEach(async () => {
    await truncateTables(dataSource, [
      'plan_activity',
      'plan_schedule',
      'plan_user_room_member',
      'plan_user_room',
      'plan_user',
    ]);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  async function createUser(): Promise<PlanUserEntity> {
    return dataSource.getRepository(PlanUserEntity).save(
      plainToInstance(PlanUserEntity, {
        name: faker.person.firstName(),
        roomShareCode: faker.string.uuid(),
        budget: 2000,
        weddingDate: '2026-12-31',
      }),
    );
  }

  /** 방과 방장 멤버를 함께 만든다. 일정 생성이 멤버 여부를 확인한다 */
  async function createRoom(owner: PlanUserEntity) {
    const room = await dataSource
      .getRepository(PlanUserRoomEntity)
      .save(plainToInstance(PlanUserRoomEntity, { ownerId: owner.id }));
    await dataSource.getRepository(PlanUserRoomMemberEntity).save(
      plainToInstance(PlanUserRoomMemberEntity, {
        roomId: room.id,
        planUserId: owner.id,
        permission: PlanUserRoomMemberPermission.OWNER,
      }),
    );
    return room;
  }

  /** 남의 방에 배우자로 들어간 상황 */
  async function joinRoom(roomId: number, user: PlanUserEntity) {
    await dataSource.getRepository(PlanUserRoomMemberEntity).save(
      plainToInstance(PlanUserRoomMemberEntity, {
        roomId,
        planUserId: user.id,
        permission: PlanUserRoomMemberPermission.SPOUSE,
      }),
    );
  }

  const add = (
    user: PlanUserEntity,
    title: string,
    amount: number,
    roomId?: number,
  ) =>
    scheduleService.postPlanSchedule(user.id, {
      categoryName: '웨딩홀',
      title,
      payType: PlanSchedulePayType.CREDIT,
      amount,
      startDate: '2026-01-17',
      ...(roomId ? { roomId } : {}),
    } as never);

  it('개인 일정과 내 방 일정을 목록·캘린더·금액이 모두 센다', async () => {
    // Given - 앱은 방에 붙여 만들지만 방 없이 만드는 경로도 있다
    const user = await createUser();
    const room = await createRoom(user);
    await add(user, '개인 일정', 100);
    await add(user, '방 일정', 200, room.id);

    // When
    const [list] = await scheduleRepo.getList(1, 100, user.id);
    const calendar = await scheduleRepo.getCalendarList(user.id, 1, 2026);
    const amount = await userService.getPlanUserAmount(user);

    // Then - 셋이 같은 것을 봐야 한다
    expect(list.map((s) => s.title).sort()).toEqual(['개인 일정', '방 일정']);
    expect(calendar.map((s) => s.title).sort()).toEqual([
      '개인 일정',
      '방 일정',
    ]);
    expect(amount.plannedUseAmount).toBe(300);
  });

  it('방 id 를 주면 그 방 것만 본다', async () => {
    // Given
    const user = await createUser();
    const room = await createRoom(user);
    await add(user, '개인 일정', 100);
    await add(user, '방 일정', 200, room.id);

    // When
    const [list] = await scheduleRepo.getList(
      1,
      100,
      user.id,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      room.id,
    );
    const calendar = await scheduleRepo.getCalendarList(
      user.id,
      1,
      2026,
      room.id,
    );

    // Then
    expect(list.map((s) => s.title)).toEqual(['방 일정']);
    expect(calendar.map((s) => s.title)).toEqual(['방 일정']);
  });

  it('남의 방 일정은 내 것으로 세지 않는다', async () => {
    // Given
    const me = await createUser();
    const other = await createUser();
    const otherRoom = await createRoom(other);
    await joinRoom(otherRoom.id, me);
    await add(me, '내 일정', 100);
    // 남의 방에 내가 만든 일정 (배우자로 참여한 상황)
    await add(me, '남의 방에 쓴 일정', 500, otherRoom.id);

    // When
    const [list] = await scheduleRepo.getList(1, 100, me.id);
    const calendar = await scheduleRepo.getCalendarList(me.id, 1, 2026);
    const amount = await userService.getPlanUserAmount(me);

    // Then
    expect(list.map((s) => s.title)).toEqual(['내 일정']);
    expect(calendar.map((s) => s.title)).toEqual(['내 일정']);
    expect(amount.plannedUseAmount).toBe(100);
  });
});

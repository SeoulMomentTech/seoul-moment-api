import { ServiceError } from '@app/common/exception/service.error';
import { PlanSchedulePayType } from '@app/repository/enum/plan-schedule.enum';
import { PlanUserRoomMemberPermission } from '@app/repository/enum/plan-user-room-member.enum';
import { PlanUserRoomMemberRepositoryService } from '@app/repository/service/plan-user--room-member.repository.service';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { PlanRoomService } from 'apps/api/src/module/plen/room/plan-room.service';
import { PlanScheduleService } from 'apps/api/src/module/plen/schedule/plan-schedule.service';
import { PlanUserService } from 'apps/api/src/module/plen/user/plan-user.service';
import { plainToInstance } from 'class-transformer';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { PlanUserEntity } from '../libs/repository/src/entity/plan-user.entity';

describe('신랑·신부 지정과 조언자 권한 (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let roomService: PlanRoomService;
  let scheduleService: PlanScheduleService;
  let userService: PlanUserService;
  let memberRepo: PlanUserRoomMemberRepositoryService;

  beforeAll(async () => {
    app = await getTestApp();
    dataSource = getDataSource(app);
    roomService = app.get(PlanRoomService);
    scheduleService = app.get(PlanScheduleService);
    userService = app.get(PlanUserService);
    memberRepo = app.get(PlanUserRoomMemberRepositoryService);
  }, 60_000);

  afterEach(async () => {
    await truncateTables(dataSource, [
      'plan_activity',
      'chat_message',
      'chat_room_member',
      'chat_room',
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
        budget: 4200,
      }),
    );
  }

  /** owner 의 공유 코드로 joiner 가 참여한다 (실제 가입 경로) */
  async function join(owner: PlanUserEntity, joiner: PlanUserEntity) {
    await roomService.postPlanRoom(joiner.id, owner.roomShareCode);
  }

  async function permissionOf(owner: PlanUserEntity, userId: string) {
    const room = await dataSource
      .getRepository(PlanUserEntity)
      .findOneOrFail({ where: { id: owner.id }, relations: ['room'] });
    const member = await memberRepo.findByRoomIdAndPlanUserId(
      room.room.id,
      userId,
    );
    return member?.permission;
  }

  // ── 기본 권한 ────────────────────────────────────────────────────
  it('공유 코드로 참여하면 조언자(READ)가 된다', async () => {
    // Given
    const owner = await createUser();
    const advisor = await createUser();

    // When
    await join(owner, advisor);

    // Then
    expect(await permissionOf(owner, owner.id)).toBe(
      PlanUserRoomMemberPermission.OWNER,
    );
    expect(await permissionOf(owner, advisor.id)).toBe(
      PlanUserRoomMemberPermission.READ,
    );
  });

  it('조언자는 일정을 만들 수 없다', async () => {
    // Given
    const owner = await createUser();
    const advisor = await createUser();
    await join(owner, advisor);
    const room = await dataSource
      .getRepository(PlanUserEntity)
      .findOneOrFail({ where: { id: owner.id }, relations: ['room'] });

    // When / Then
    await expect(
      scheduleService.postPlanSchedule(advisor.id, {
        categoryName: '스드메',
        title: '드레스 투어',
        payType: PlanSchedulePayType.CREDIT,
        amount: 100,
        roomId: room.room.id,
      } as never),
    ).rejects.toBeInstanceOf(ServiceError);
  });

  // ── 배우자 지정 ──────────────────────────────────────────────────
  it('방장이 지정하면 배우자가 되고 일정을 만들 수 있다', async () => {
    // Given
    const owner = await createUser();
    const spouse = await createUser();
    await join(owner, spouse);
    const room = await dataSource
      .getRepository(PlanUserEntity)
      .findOneOrFail({ where: { id: owner.id }, relations: ['room'] });

    // When
    await roomService.patchPlanRoomSpouse(owner.id, spouse.id);

    // Then
    expect(await permissionOf(owner, spouse.id)).toBe(
      PlanUserRoomMemberPermission.SPOUSE,
    );
    const created = await scheduleService.postPlanSchedule(spouse.id, {
      categoryName: '스드메',
      title: '드레스 투어',
      payType: PlanSchedulePayType.CREDIT,
      amount: 100,
      roomId: room.room.id,
    } as never);
    expect(created.id).toBeTruthy();
  });

  it('배우자는 한 명뿐이라 새로 지정하면 이전 사람은 조언자로 내려간다', async () => {
    // Given
    const owner = await createUser();
    const first = await createUser();
    const second = await createUser();
    await join(owner, first);
    await join(owner, second);
    await roomService.patchPlanRoomSpouse(owner.id, first.id);

    // When
    await roomService.patchPlanRoomSpouse(owner.id, second.id);

    // Then
    expect(await permissionOf(owner, first.id)).toBe(
      PlanUserRoomMemberPermission.READ,
    );
    expect(await permissionOf(owner, second.id)).toBe(
      PlanUserRoomMemberPermission.SPOUSE,
    );
  });

  it('지정을 풀면 조언자로 돌아간다', async () => {
    // Given
    const owner = await createUser();
    const spouse = await createUser();
    await join(owner, spouse);
    await roomService.patchPlanRoomSpouse(owner.id, spouse.id);

    // When
    await roomService.patchPlanRoomSpouse(owner.id, null);

    // Then
    expect(await permissionOf(owner, spouse.id)).toBe(
      PlanUserRoomMemberPermission.READ,
    );
  });

  it('방장이 아니면 지정할 수 없다', async () => {
    // Given
    const owner = await createUser();
    const advisor = await createUser();
    const other = await createUser();
    await join(owner, advisor);
    await join(owner, other);

    // When / Then - advisor 는 자기 플랜 방이 없어 NOT_FOUND 로 막힌다
    await expect(
      roomService.patchPlanRoomSpouse(advisor.id, other.id),
    ).rejects.toBeInstanceOf(ServiceError);
  });

  it('자기 자신은 배우자로 지정할 수 없다', async () => {
    // Given
    const owner = await createUser();
    const advisor = await createUser();
    await join(owner, advisor);

    // When / Then
    await expect(
      roomService.patchPlanRoomSpouse(owner.id, owner.id),
    ).rejects.toBeInstanceOf(ServiceError);
  });

  it('방 멤버가 아닌 사람은 배우자로 지정할 수 없다', async () => {
    // Given
    const owner = await createUser();
    const advisor = await createUser();
    const stranger = await createUser();
    await join(owner, advisor);

    // When / Then
    await expect(
      roomService.patchPlanRoomSpouse(owner.id, stranger.id),
    ).rejects.toBeInstanceOf(ServiceError);
  });

  // ── 커플 채팅방 식별 ─────────────────────────────────────────────
  it('배우자와의 채팅방만 isCouple 이다', async () => {
    // Given - 참여자마다 방장과의 채팅방이 하나씩 생긴다
    const owner = await createUser();
    const spouse = await createUser();
    const advisor = await createUser();
    await join(owner, spouse);
    await join(owner, advisor);
    await roomService.patchPlanRoomSpouse(owner.id, spouse.id);

    // When - 방장이 보는 대화 목록
    const rooms = await userService.getUserChatRoomList(owner.id);

    // Then
    expect(rooms).toHaveLength(2);
    expect(rooms.filter((r) => r.isCouple)).toHaveLength(1);
  });

  it('배우자를 지정하기 전에는 커플 방이 없다', async () => {
    // Given
    const owner = await createUser();
    const advisor = await createUser();
    await join(owner, advisor);

    // When
    const rooms = await userService.getUserChatRoomList(owner.id);

    // Then
    expect(rooms.some((r) => r.isCouple)).toBe(false);
  });
});

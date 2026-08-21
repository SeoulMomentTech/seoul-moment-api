import { DatabaseSort } from '@app/common/enum/global.enum';
import { PlanActivityType } from '@app/repository/enum/plan-activity.enum';
import {
  PlanSchedulePayType,
  PlanScheduleStatus,
} from '@app/repository/enum/plan-schedule.enum';
import { PlanUserRoomMemberPermission } from '@app/repository/enum/plan-user-room-member.enum';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { PlanActivityService } from 'apps/api/src/module/plen/activity/plan-activity.service';
import { PlanScheduleService } from 'apps/api/src/module/plen/schedule/plan-schedule.service';
import { PlanSettingService } from 'apps/api/src/module/plen/setting/plan-setting.service';
import { plainToInstance } from 'class-transformer';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { PlanUserRoomMemberEntity } from '../libs/repository/src/entity/plan-user-room-member.entity';
import { PlanUserRoomEntity } from '../libs/repository/src/entity/plan-user-room.entity';
import { PlanUserEntity } from '../libs/repository/src/entity/plan-user.entity';

describe('Plan activity log (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let activityService: PlanActivityService;
  let scheduleService: PlanScheduleService;
  let settingService: PlanSettingService;

  beforeAll(async () => {
    // Given - 앱 싱글톤 획득 (최초 1회만 부트스트랩)
    app = await getTestApp();
    dataSource = getDataSource(app);
    activityService = app.get(PlanActivityService);
    scheduleService = app.get(PlanScheduleService);
    settingService = app.get(PlanSettingService);
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

  // -------------------------------------------------------------------------
  // 헬퍼
  // -------------------------------------------------------------------------
  async function createPlanUser(budget = 4200): Promise<PlanUserEntity> {
    return dataSource.getRepository(PlanUserEntity).save(
      plainToInstance(PlanUserEntity, {
        name: faker.person.firstName(),
        roomShareCode: faker.string.uuid(),
        budget,
      }),
    );
  }

  async function createRoom(
    owner: PlanUserEntity,
    members: PlanUserEntity[],
  ): Promise<PlanUserRoomEntity> {
    const room = await dataSource.getRepository(PlanUserRoomEntity).save(
      plainToInstance(PlanUserRoomEntity, {
        ownerId: owner.id,
      }),
    );

    for (const member of [owner, ...members]) {
      await dataSource.getRepository(PlanUserRoomMemberEntity).save(
        plainToInstance(PlanUserRoomMemberEntity, {
          roomId: room.id,
          planUserId: member.id,
          permission:
            member.id === owner.id
              ? PlanUserRoomMemberPermission.OWNER
              : PlanUserRoomMemberPermission.WRITE,
        }),
      );
    }

    return room;
  }

  function addSchedule(planUserId: string, roomId?: number, amount = 185) {
    return scheduleService.postPlanSchedule(planUserId, {
      categoryName: '스드메',
      title: '본식 촬영',
      payType: PlanSchedulePayType.CREDIT,
      amount,
      roomId,
    } as never);
  }

  // -------------------------------------------------------------------------
  it('플랜을 추가하면 활동으로 남고 개인 목록에서 보인다', async () => {
    // Given
    const user = await createPlanUser();

    // When
    const schedule = await addSchedule(user.id);

    // Then
    const [list, total] = await activityService.getPlanActivityList(
      user.id,
      1,
      10,
      DatabaseSort.DESC,
    );

    expect(total).toBe(1);
    expect(list[0].type).toBe(PlanActivityType.SCHEDULE_CREATED);
    expect(list[0].actorPlanUserId).toBe(user.id);
    expect(list[0].actorName).toBe(user.name);
    expect(list[0].targetId).toBe(schedule.id);
    expect(list[0].targetTitle).toBe('본식 촬영');
    expect(list[0].amount).toBe(185);
  });

  it('완료로 바꾸면 남고, 완료를 해제하면 남지 않는다', async () => {
    // Given
    const user = await createPlanUser();
    const schedule = await addSchedule(user.id);

    // When - 완료 → 해제
    await scheduleService.patchPlanScheduleStatus(
      schedule.id,
      PlanScheduleStatus.COMPLETED,
      user.id,
    );
    await scheduleService.patchPlanScheduleStatus(
      schedule.id,
      PlanScheduleStatus.NORMAL,
      user.id,
    );

    // Then - 완료 1건만 (해제는 기록하지 않는다)
    const [list] = await activityService.getPlanActivityList(
      user.id,
      1,
      10,
      DatabaseSort.DESC,
    );

    const completed = list.filter(
      (a) => a.type === PlanActivityType.SCHEDULE_COMPLETED,
    );
    expect(completed).toHaveLength(1);
  });

  it('플랜을 지워도 제목이 활동에 남는다', async () => {
    // Given
    const user = await createPlanUser();
    const schedule = await addSchedule(user.id);

    // When
    await scheduleService.deletePlanSchedule(schedule.id, user.id);

    // Then
    const [list] = await activityService.getPlanActivityList(
      user.id,
      1,
      10,
      DatabaseSort.DESC,
    );

    const deleted = list.find(
      (a) => a.type === PlanActivityType.SCHEDULE_DELETED,
    );
    expect(deleted).toBeDefined();
    expect(deleted.targetTitle).toBe('본식 촬영');
  });

  it('예산이 실제로 바뀐 경우에만 남는다', async () => {
    // Given
    const user = await createPlanUser(4200);
    const body = {
      weddingDate: '2026-11-14',
      budget: 4200,
      name: user.name,
      requiredAgreementDate: '2026-08-20',
    };

    // When - 같은 값으로 저장 → 기록 없음
    await settingService.postPlanSetting(user.id, body as never);

    const [sameValueList] = await activityService.getPlanActivityList(
      user.id,
      1,
      10,
      DatabaseSort.DESC,
    );
    expect(
      sameValueList.filter((a) => a.type === PlanActivityType.BUDGET_UPDATED),
    ).toHaveLength(0);

    // When - 값을 바꿔 저장 → 기록 1건
    await settingService.postPlanSetting(user.id, {
      ...body,
      budget: 5000,
    } as never);

    // Then
    const [changedList] = await activityService.getPlanActivityList(
      user.id,
      1,
      10,
      DatabaseSort.DESC,
    );
    const budgetActivities = changedList.filter(
      (a) => a.type === PlanActivityType.BUDGET_UPDATED,
    );
    expect(budgetActivities).toHaveLength(1);
    expect(budgetActivities[0].amount).toBe(5000);
  });

  it('방 기록은 멤버만 볼 수 있고, 개인 목록에는 섞이지 않는다', async () => {
    // Given - owner 와 member 가 있는 방, 그리고 무관한 제3자
    const owner = await createPlanUser();
    const member = await createPlanUser();
    const stranger = await createPlanUser();
    const room = await createRoom(owner, [member]);

    await addSchedule(owner.id, room.id);

    // When - 멤버가 방 기록을 조회
    const [roomList, roomTotal] = await activityService.getPlanActivityList(
      member.id,
      1,
      10,
      DatabaseSort.DESC,
      room.id,
    );

    // Then
    expect(roomTotal).toBe(1);
    expect(roomList[0].type).toBe(PlanActivityType.SCHEDULE_CREATED);

    // And - 방 활동은 개인 목록에 끼지 않는다 (같은 줄이 두 번 보이지 않게)
    const [personalList] = await activityService.getPlanActivityList(
      owner.id,
      1,
      10,
      DatabaseSort.DESC,
    );
    expect(personalList).toHaveLength(0);

    // And - 멤버가 아니면 볼 수 없다
    await expect(
      activityService.getPlanActivityList(
        stranger.id,
        1,
        10,
        DatabaseSort.DESC,
        room.id,
      ),
    ).rejects.toThrow();
  });

  it('기록이 실패해도 원래 동작은 성공한다', async () => {
    // Given - 활동 저장이 터지는 상황
    const user = await createPlanUser();
    const repositoryService = (
      activityService as unknown as {
        planActivityRepositoryService: { create: () => Promise<never> };
      }
    ).planActivityRepositoryService;
    const spy = jest
      .spyOn(repositoryService, 'create')
      .mockRejectedValue(new Error('boom'));

    // When
    const schedule = await addSchedule(user.id);

    // Then - 플랜 저장 자체는 성공한다
    expect(schedule.id).toBeDefined();

    spy.mockRestore();
  });
});

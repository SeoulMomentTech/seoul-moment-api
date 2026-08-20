import {
  PlanSchedulePayType,
  PlanScheduleStatus,
} from '@app/repository/enum/plan-schedule.enum';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { PlanScheduleService } from 'apps/api/src/module/plen/schedule/plan-schedule.service';
import { PlanSettingService } from 'apps/api/src/module/plen/setting/plan-setting.service';
import { GetPlanUserResponse } from 'apps/api/src/module/plen/user/plan-user.dto';
import { plainToInstance } from 'class-transformer';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { PlanUserEntity } from '../libs/repository/src/entity/plan-user.entity';

describe('일정 시각 · 예식장 이름 (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let scheduleService: PlanScheduleService;
  let settingService: PlanSettingService;

  beforeAll(async () => {
    app = await getTestApp();
    dataSource = getDataSource(app);
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

  async function createPlanUser(): Promise<PlanUserEntity> {
    return dataSource.getRepository(PlanUserEntity).save(
      plainToInstance(PlanUserEntity, {
        name: faker.person.firstName(),
        roomShareCode: faker.string.uuid(),
        budget: 4200,
      }),
    );
  }

  /** 컨트롤러는 가드가 실어 준 엔티티로 응답을 만든다. 같은 경로를 흉내낸다 */
  async function readUserResponse(id: string) {
    const entity = await dataSource
      .getRepository(PlanUserEntity)
      .findOneByOrFail({ id });
    return GetPlanUserResponse.from(entity);
  }

  function addSchedule(planUserId: string, extra: Record<string, unknown>) {
    return scheduleService.postPlanSchedule(planUserId, {
      categoryName: '스드메',
      title: '드레스 투어',
      payType: PlanSchedulePayType.CREDIT,
      amount: 185,
      ...extra,
    } as never);
  }

  // ── 일정 시각 ────────────────────────────────────────────────────
  it('시각을 넣어 만들면 상세와 달력에서 모두 보인다', async () => {
    // Given
    const user = await createPlanUser();

    // When
    const created = await addSchedule(user.id, {
      startDate: '2026-08-23',
      startTime: '11:00',
    });

    // Then
    expect(created.startTime).toBe('11:00');

    const detail = await scheduleService.getPlanScheduleDetail(
      created.id,
      user.id,
    );
    expect(detail.startTime).toBe('11:00');

    const calendar = await scheduleService.getCalendarList(user.id, 8, 2026);
    const item = calendar.find((d) => d.day === '2026-08-23')?.list[0];
    expect(item?.startTime).toBe('11:00');
    expect(item?.amount).toBe(185);
    expect(item?.categoryName).toBe('스드메');
  });

  it('시각 없이 만들면 null 이고 날짜만 남는다', async () => {
    // Given / When
    const user = await createPlanUser();
    const created = await addSchedule(user.id, { startDate: '2026-08-23' });

    // Then
    expect(created.startTime).toBeNull();
    expect(created.startDate).toBeTruthy();
  });

  it('빈 문자열을 보내면 시각만 지워지고 날짜는 남는다', async () => {
    // Given
    const user = await createPlanUser();
    const created = await addSchedule(user.id, {
      startDate: '2026-08-23',
      startTime: '11:00',
    });

    // When
    await scheduleService.patchPlanSchedule(
      created.id,
      { startTime: '' } as never,
      user.id,
    );

    // Then
    const detail = await scheduleService.getPlanScheduleDetail(
      created.id,
      user.id,
    );
    expect(detail.startTime).toBeNull();
    expect(detail.startDate).toBeTruthy();
  });

  it('날짜만 PATCH 해도 시각·제목·금액이 지워지지 않는다', async () => {
    // Given - 보드에서 카드를 다른 달로 끌 때가 이 경로다
    const user = await createPlanUser();
    const created = await addSchedule(user.id, {
      startDate: '2026-08-23',
      startTime: '11:00',
    });

    // When
    await scheduleService.patchPlanSchedule(
      created.id,
      { startDate: '2026-09-23' } as never,
      user.id,
    );

    // Then
    const detail = await scheduleService.getPlanScheduleDetail(
      created.id,
      user.id,
    );
    expect(detail.startTime).toBe('11:00');
    expect(detail.title).toBe('드레스 투어');
    expect(detail.amount).toBe(185);
  });

  it('시각만 PATCH 해도 날짜가 지워지지 않는다', async () => {
    // Given - 예전에는 startDate 를 무조건 null 로 덮어써서 날아갔다
    const user = await createPlanUser();
    const created = await addSchedule(user.id, {
      startDate: '2026-08-23',
      startTime: '11:00',
    });

    // When
    await scheduleService.patchPlanSchedule(
      created.id,
      { startTime: '14:30' } as never,
      user.id,
    );

    // Then
    const detail = await scheduleService.getPlanScheduleDetail(
      created.id,
      user.id,
    );
    expect(detail.startTime).toBe('14:30');
    expect(detail.startDate).toBeTruthy();
  });

  it('완료한 일정도 달력 응답에 시각·금액과 함께 남는다', async () => {
    // Given
    const user = await createPlanUser();
    const created = await addSchedule(user.id, {
      startDate: '2026-08-02',
      startTime: '15:00',
    });

    // When
    await scheduleService.patchPlanScheduleStatus(
      created.id,
      PlanScheduleStatus.COMPLETED,
      user.id,
    );

    // Then
    const calendar = await scheduleService.getCalendarList(user.id, 8, 2026);
    const item = calendar.find((d) => d.day === '2026-08-02')?.list[0];
    expect(item?.status).toBe(PlanScheduleStatus.COMPLETED);
    expect(item?.startTime).toBe('15:00');
    expect(item?.amount).toBe(185);
  });

  // ── 예식장 이름 ──────────────────────────────────────────────────
  it('예식장 이름을 저장하면 사용자 조회에서 그대로 나온다', async () => {
    // Given
    const user = await createPlanUser();

    // When
    const saved = await settingService.postPlanSetting(user.id, {
      weddingDate: '2026-11-14',
      budget: 4200,
      name: '지수',
      weddingVenue: '그랜드하얏트 서울',
    } as never);

    // Then
    expect(saved.weddingVenue).toBe('그랜드하얏트 서울');

    const fetched = await readUserResponse(user.id);
    expect(fetched.weddingVenue).toBe('그랜드하얏트 서울');
  });

  it('예식장을 안 보낸 저장은 이미 넣어 둔 값을 지우지 않는다', async () => {
    // Given - 온보딩(/setting)은 예식장을 묻지 않는다
    const user = await createPlanUser();
    await settingService.postPlanSetting(user.id, {
      budget: 4200,
      name: '지수',
      weddingVenue: '그랜드하얏트 서울',
    } as never);

    // When
    await settingService.postPlanSetting(user.id, {
      budget: 5000,
      name: '지수',
    } as never);

    // Then
    const fetched = await readUserResponse(user.id);
    expect(fetched.weddingVenue).toBe('그랜드하얏트 서울');
    expect(fetched.budget).toBe(5000);
  });

  it('빈 문자열을 보내면 예식장 이름이 지워진다', async () => {
    // Given
    const user = await createPlanUser();
    await settingService.postPlanSetting(user.id, {
      budget: 4200,
      name: '지수',
      weddingVenue: '그랜드하얏트 서울',
    } as never);

    // When
    await settingService.postPlanSetting(user.id, {
      budget: 4200,
      name: '지수',
      weddingVenue: '',
    } as never);

    // Then
    const fetched = await readUserResponse(user.id);
    expect(fetched.weddingVenue).toBeNull();
  });
});

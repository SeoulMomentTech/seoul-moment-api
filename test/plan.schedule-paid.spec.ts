import {
  PlanSchedulePayType,
  PlanScheduleStatus,
  isSchedulePaid,
} from '@app/repository/enum/plan-schedule.enum';
import { PlanScheduleRepositoryService } from '@app/repository/service/plan-schedule.repository.service';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { PlanScheduleService } from 'apps/api/src/module/plen/schedule/plan-schedule.service';
import { plainToInstance } from 'class-transformer';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { PlanScheduleEntity } from '../libs/repository/src/entity/plan-schedule.entity';
import { PlanUserEntity } from '../libs/repository/src/entity/plan-user.entity';

/**
 * 결제와 일정 완료는 **다른 축이다.**
 *
 * 예식장 계약금을 미리 내고 예식은 내년인 경우가 흔한데, 축이 하나뿐이던
 * 시절에는 그 돈이 "아직 안 쓴 예정" 으로 잡혔다 — 통장에서는 이미
 * 빠져나갔는데도 예산에 안 보였다.
 */
describe('일정의 결제 여부 (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let scheduleService: PlanScheduleService;
  let scheduleRepo: PlanScheduleRepositoryService;

  beforeAll(async () => {
    app = await getTestApp();
    dataSource = getDataSource(app);
    scheduleService = app.get(PlanScheduleService);
    scheduleRepo = app.get(PlanScheduleRepositoryService);
  }, 60_000);

  afterEach(async () => {
    await truncateTables(dataSource, [
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
        weddingDate: '2026-11-14',
      }),
    );
  }

  async function createSchedule(
    user: PlanUserEntity,
    override: Record<string, unknown> = {},
  ): Promise<PlanScheduleEntity> {
    return dataSource.getRepository(PlanScheduleEntity).save(
      plainToInstance(PlanScheduleEntity, {
        planUserId: user.id,
        categoryName: '예식장',
        title: '예식장 계약금',
        payType: PlanSchedulePayType.CASH,
        amount: 620,
        startDate: '2026-10-03',
        status: PlanScheduleStatus.NORMAL,
        ...override,
      }),
    );
  }

  describe('규칙', () => {
    it('isPaid 가 있으면 그 값을 쓴다', () => {
      expect(
        isSchedulePaid({ isPaid: true, status: PlanScheduleStatus.NORMAL }),
      ).toBe(true);
      expect(
        isSchedulePaid({ isPaid: false, status: PlanScheduleStatus.COMPLETED }),
      ).toBe(false);
    });

    /**
     * 이 컬럼이 생기기 전에 만들어진 일정이다. 그때는 완료가 곧 결제였다.
     * **`null` 과 `false` 를 같게 다루면** 쌓여 있는 완료 일정이 통째로
     * 미결제로 바뀌어 예산의 지출이 0 이 된다.
     */
    it('isPaid 가 null 이면 완료 여부를 따라간다 (예전 데이터)', () => {
      expect(
        isSchedulePaid({ isPaid: null, status: PlanScheduleStatus.COMPLETED }),
      ).toBe(true);
      expect(
        isSchedulePaid({ isPaid: null, status: PlanScheduleStatus.NORMAL }),
      ).toBe(false);
    });
  });

  describe('예산', () => {
    it('예정인데 결제한 돈은 지출로 센다', async () => {
      const user = await createUser();
      await createSchedule(user, {
        amount: 620,
        status: PlanScheduleStatus.NORMAL,
        isPaid: true,
      });

      expect(await scheduleRepo.getUsedAmount(user.id)).toBe(620);
      expect(await scheduleRepo.getPlannedUseAmount(user.id)).toBe(0);
    });

    it('끝났는데 아직 안 낸 돈은 예정으로 센다', async () => {
      const user = await createUser();
      await createSchedule(user, {
        amount: 300,
        status: PlanScheduleStatus.COMPLETED,
        isPaid: false,
      });

      expect(await scheduleRepo.getUsedAmount(user.id)).toBe(0);
      expect(await scheduleRepo.getPlannedUseAmount(user.id)).toBe(300);
    });

    it('예전 데이터(isPaid null)는 예전과 똑같이 나온다', async () => {
      const user = await createUser();
      await createSchedule(user, {
        amount: 620,
        status: PlanScheduleStatus.COMPLETED,
        isPaid: null,
      });
      await createSchedule(user, {
        amount: 180,
        status: PlanScheduleStatus.NORMAL,
        isPaid: null,
      });

      expect(await scheduleRepo.getUsedAmount(user.id)).toBe(620);
      expect(await scheduleRepo.getPlannedUseAmount(user.id)).toBe(180);
    });

    it('지운 일정은 어느 쪽으로도 안 센다', async () => {
      const user = await createUser();
      await createSchedule(user, {
        amount: 999,
        status: PlanScheduleStatus.DELETE,
        isPaid: true,
      });

      expect(await scheduleRepo.getUsedAmount(user.id)).toBe(0);
      expect(await scheduleRepo.getPlannedUseAmount(user.id)).toBe(0);
    });

    it('카테고리 차트도 결제 기준으로 센다', async () => {
      const user = await createUser();
      await createSchedule(user, {
        categoryName: '예식장',
        amount: 620,
        status: PlanScheduleStatus.NORMAL,
        isPaid: true,
      });
      await createSchedule(user, {
        categoryName: '스드메',
        amount: 300,
        status: PlanScheduleStatus.COMPLETED,
        isPaid: false,
      });

      const chart = await scheduleRepo.getCategoryChartList(user.id);
      const hall = chart.find((c) => c.categoryName === '예식장');
      const sdm = chart.find((c) => c.categoryName === '스드메');

      // 예정이어도 냈으면 지출, 완료여도 안 냈으면 지출이 아니다
      expect(hall?.usedAmount).toBe(620);
      expect(sdm?.usedAmount).toBe(0);
    });
  });

  describe('결제 토글', () => {
    it('일정 상태는 건드리지 않는다', async () => {
      const user = await createUser();
      const schedule = await createSchedule(user, {
        status: PlanScheduleStatus.NORMAL,
      });

      const result = await scheduleService.patchPlanSchedulePaid(
        schedule.id,
        true,
        user.id,
      );

      expect(result.isPaid).toBe(true);
      const after = await dataSource
        .getRepository(PlanScheduleEntity)
        .findOneBy({ id: schedule.id });
      expect(after?.status).toBe(PlanScheduleStatus.NORMAL);
      expect(after?.isPaid).toBe(true);
    });

    it('되돌릴 수 있다', async () => {
      const user = await createUser();
      const schedule = await createSchedule(user, { isPaid: true });

      await scheduleService.patchPlanSchedulePaid(schedule.id, false, user.id);

      expect(await scheduleRepo.getUsedAmount(user.id)).toBe(0);
      expect(await scheduleRepo.getPlannedUseAmount(user.id)).toBe(620);
    });

    /**
     * 완료 토글은 결제를 건드리지 않는다. 미리 낸 계약금의 일정이 끝났다고
     * 표시했을 때 결제가 풀리면 안 된다.
     */
    it('완료 토글은 결제를 건드리지 않는다', async () => {
      const user = await createUser();
      const schedule = await createSchedule(user, {
        status: PlanScheduleStatus.NORMAL,
        isPaid: true,
      });

      await scheduleService.patchPlanScheduleStatus(
        schedule.id,
        PlanScheduleStatus.COMPLETED,
        user.id,
      );

      const after = await dataSource
        .getRepository(PlanScheduleEntity)
        .findOneBy({ id: schedule.id });
      expect(after?.isPaid).toBe(true);
      expect(await scheduleRepo.getUsedAmount(user.id)).toBe(620);
    });
  });
});

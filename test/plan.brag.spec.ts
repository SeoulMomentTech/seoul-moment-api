import { ServiceError } from '@app/common/exception/service.error';
import {
  PlanBragSort,
  PlanBragStatus,
} from '@app/repository/enum/plan-brag.enum';
import {
  PlanSchedulePayType,
  PlanScheduleStatus,
} from '@app/repository/enum/plan-schedule.enum';
import { PlanUserRoomMemberPermission } from '@app/repository/enum/plan-user-room-member.enum';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { PlanBragService } from 'apps/api/src/module/plen/brag/plan-brag.service';
import { plainToInstance } from 'class-transformer';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { PlanBragEntity } from '../libs/repository/src/entity/plan-brag.entity';
import { PlanScheduleEntity } from '../libs/repository/src/entity/plan-schedule.entity';
import { PlanUserRoomMemberEntity } from '../libs/repository/src/entity/plan-user-room-member.entity';
import { PlanUserRoomEntity } from '../libs/repository/src/entity/plan-user-room.entity';
import { PlanUserEntity } from '../libs/repository/src/entity/plan-user.entity';

describe('자랑하기 (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let bragService: PlanBragService;

  beforeAll(async () => {
    app = await getTestApp();
    dataSource = getDataSource(app);
    bragService = app.get(PlanBragService);
  }, 60_000);

  afterEach(async () => {
    await truncateTables(dataSource, [
      'plan_brag_like',
      'plan_brag',
      'plan_schedule',
      'plan_user_room_member',
      'plan_user_room',
      'plan_user',
    ]);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  /** `weddingDate` 를 문자열로 넣을 수 있게 느슨한 타입을 쓴다 (date 컬럼) */
  async function createUser(
    override: Record<string, unknown> = {},
  ): Promise<PlanUserEntity> {
    return dataSource.getRepository(PlanUserEntity).save(
      plainToInstance(PlanUserEntity, {
        name: faker.person.firstName(),
        roomShareCode: faker.string.uuid(),
        budget: 4200,
        weddingDate: '2026-11-14',
        ...override,
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
        categoryName: '스드메',
        title: '아뜰리에 진',
        payType: PlanSchedulePayType.CREDIT,
        amount: 385,
        startDate: '2026-08-12',
        status: PlanScheduleStatus.COMPLETED,
        ...override,
      }),
    );
  }

  /** 방장 + 배우자. "지수 · 현우" 가 나오는 조건을 만든다 */
  async function addSpouse(
    owner: PlanUserEntity,
    spouse: PlanUserEntity,
  ): Promise<void> {
    const room = await dataSource
      .getRepository(PlanUserRoomEntity)
      .save(plainToInstance(PlanUserRoomEntity, { ownerId: owner.id }));

    await dataSource.getRepository(PlanUserRoomMemberEntity).save([
      plainToInstance(PlanUserRoomMemberEntity, {
        roomId: room.id,
        planUserId: owner.id,
        permission: PlanUserRoomMemberPermission.OWNER,
      }),
      plainToInstance(PlanUserRoomMemberEntity, {
        roomId: room.id,
        planUserId: spouse.id,
        permission: PlanUserRoomMemberPermission.SPOUSE,
      }),
    ]);
  }

  const findBrag = (planUserId: string) =>
    dataSource.getRepository(PlanBragEntity).findOne({ where: { planUserId } });

  describe('올리기 — 스냅샷', () => {
    it('지출·예정·개수를 지금 플랜에서 그대로 뜬다', async () => {
      const user = await createUser();
      await createSchedule(user, { categoryName: '예식장', amount: 620 });
      await createSchedule(user, { categoryName: '스드메', amount: 300 });
      await createSchedule(user, {
        categoryName: '스드메',
        amount: 35,
        status: PlanScheduleStatus.NORMAL,
      });

      const bragId = await bragService.publish(user.id);
      const detail = await bragService.getPlanBragDetail(user.id, bragId);

      // 지출은 완료한 것만, 예정은 아직 완료하지 않은 것만
      expect(detail.usedAmount).toBe(920);
      expect(detail.plannedAmount).toBe(35);
      expect(detail.planCount).toBe(3);
      expect(detail.doneCount).toBe(2);
      expect(detail.totalBudget).toBe(4200);
    });

    it('막대·범례는 지출 큰 순이고, 한 푼도 안 쓴 카테고리는 빠진다', async () => {
      const user = await createUser();
      await createSchedule(user, { categoryName: '스드메', amount: 300 });
      await createSchedule(user, { categoryName: '예식장', amount: 1240 });
      await createSchedule(user, {
        categoryName: '혼수',
        amount: 100,
        status: PlanScheduleStatus.NORMAL,
      });

      const bragId = await bragService.publish(user.id);
      const detail = await bragService.getPlanBragDetail(user.id, bragId);

      expect(detail.categoryChart).toEqual([
        { categoryName: '예식장', usedAmount: 1240 },
        { categoryName: '스드메', usedAmount: 300 },
      ]);
      // 앱이 상위 4개에만 색을 준다. 순서가 뒤집히면 색이 매번 바뀐다
      expect(detail.categories).toEqual(['예식장', '스드메']);
    });

    /**
     * 공개 범위는 앱의 안내 모달이 글자 그대로 약속한 것까지다.
     * **여기 새 필드가 새면 동의받지 않은 것을 공개하게 된다.**
     */
    it('일정의 시각·메모를 담지 않는다 (장소는 담는다)', async () => {
      const user = await createUser();
      await createSchedule(user, {
        startTime: '11:00',
        location: 'SG 웨딩홀',
        locationLat: 37.5006,
        locationLng: 127.0364,
        memo: '헬퍼비 25만원 별도',
      });

      const bragId = await bragService.publish(user.id);
      const detail = await bragService.getPlanBragDetail(user.id, bragId);

      // **이 목록이 곧 공개 범위다.** 늘리려면 안내 모달의 OPEN_FIELDS 를
      // 먼저 고쳐야 한다 — 여기 새 필드가 새면 동의받지 않은 것을 공개한다
      expect(Object.keys(detail.items[0]).sort()).toEqual([
        'amount',
        'categoryName',
        'id',
        'lat',
        'lng',
        'location',
        'startDate',
        'status',
        'title',
      ]);
      expect(JSON.stringify(detail.items)).not.toContain('11:00');
      expect(JSON.stringify(detail.items)).not.toContain('헬퍼비');
    });

    /**
     * `decimal` 은 드라이버가 문자열로 준다. 그대로 내보내면 앱이
     * `new kakao.maps.LatLng("37.5")` 를 불러 지도가 안 뜬다.
     */
    it('좌표를 문자열이 아니라 숫자로 준다', async () => {
      const user = await createUser();
      await createSchedule(user, {
        location: 'SG 웨딩홀',
        locationLat: 37.5006,
        locationLng: 127.0364,
      });

      const bragId = await bragService.publish(user.id);
      const detail = await bragService.getPlanBragDetail(user.id, bragId);

      expect(detail.items[0].location).toBe('SG 웨딩홀');
      expect(typeof detail.items[0].lat).toBe('number');
      expect(typeof detail.items[0].lng).toBe('number');
      expect(detail.items[0].lat).toBeCloseTo(37.5006, 3);
    });

    it('장소를 안 고른 일정은 좌표가 null 이다', async () => {
      const user = await createUser();
      await createSchedule(user, { location: null });

      const bragId = await bragService.publish(user.id);
      const detail = await bragService.getPlanBragDetail(user.id, bragId);

      expect(detail.items[0].location).toBeNull();
      expect(detail.items[0].lat).toBeNull();
      expect(detail.items[0].lng).toBeNull();
    });

    it('배우자가 있으면 두 이름이 나란히 붙는다', async () => {
      const owner = await createUser({ name: '지수' });
      const spouse = await createUser({ name: '현우' });
      await addSpouse(owner, spouse);

      const bragId = await bragService.publish(owner.id);
      const detail = await bragService.getPlanBragDetail(owner.id, bragId);

      expect(detail.nickname).toBe('지수 · 현우');
    });

    it('온보딩을 마치지 않았으면 올리지 못한다', async () => {
      const noName = await createUser({ name: null });
      const noDate = await createUser({ weddingDate: null });

      await expect(bragService.publish(noName.id)).rejects.toBeInstanceOf(
        ServiceError,
      );
      await expect(bragService.publish(noDate.id)).rejects.toBeInstanceOf(
        ServiceError,
      );
    });

    /**
     * 앱이 "올린 뒤에는 고칠 수 없어요" 라고 약속했다. 여기서 다시 스냅샷을
     * 뜨면 켠 채로 예산을 고쳐도 남의 화면이 따라 바뀐다 — 약속이 조용히
     * 깨지는 자리다.
     */
    it('이미 올라가 있으면 다시 스냅샷을 뜨지 않는다', async () => {
      const user = await createUser();
      await createSchedule(user, { amount: 300 });

      const first = await bragService.publish(user.id);
      await createSchedule(user, { amount: 999, title: '나중에 추가한 일정' });
      const second = await bragService.publish(user.id);

      expect(second).toBe(first);
      const detail = await bragService.getPlanBragDetail(user.id, first);
      expect(detail.planCount).toBe(1);
      expect(detail.usedAmount).toBe(300);
    });
  });

  describe('내리기', () => {
    it('목록에서 빠지고 상세는 404 가 된다', async () => {
      const user = await createUser();
      await createSchedule(user);
      const bragId = await bragService.publish(user.id);

      await bragService.unpublish(user.id);

      const [list, total] = await bragService.getPlanBragList(user.id, {});
      expect(list).toHaveLength(0);
      expect(total).toBe(0);
      await expect(
        bragService.getPlanBragDetail(user.id, bragId),
      ).rejects.toBeInstanceOf(ServiceError);
    });

    it('행을 지우지 않는다 — 상태만 내려 둔다', async () => {
      const user = await createUser();
      await createSchedule(user);
      await bragService.publish(user.id);

      await bragService.unpublish(user.id);

      const row = await findBrag(user.id);
      expect(row).not.toBeNull();
      expect(row?.status).toBe(PlanBragStatus.UNPUBLISHED);
    });

    it('내렸다 다시 올리면 좋아요가 이어지고 스냅샷은 새로 뜬다', async () => {
      const user = await createUser();
      const viewer = await createUser();
      await createSchedule(user, { amount: 300 });

      const bragId = await bragService.publish(user.id);
      await bragService.like(viewer.id, bragId);

      await bragService.unpublish(user.id);
      await createSchedule(user, { amount: 200, title: '추가한 일정' });
      const again = await bragService.publish(user.id);

      expect(again).toBe(bragId);
      const detail = await bragService.getPlanBragDetail(viewer.id, again);
      // 좋아요는 그대로, 내용은 새로
      expect(detail.likeCount).toBe(1);
      expect(detail.liked).toBe(true);
      expect(detail.planCount).toBe(2);
      expect(detail.usedAmount).toBe(500);
    });

    it('내 상태에는 내려가 있어도 받은 좋아요가 남는다', async () => {
      const user = await createUser();
      const viewer = await createUser();
      await createSchedule(user);
      const bragId = await bragService.publish(user.id);
      await bragService.like(viewer.id, bragId);

      await bragService.unpublish(user.id);

      const status = await bragService.getMyStatus(user.id);
      expect(status.published).toBe(false);
      expect(status.bragId).toBeNull();
      expect(status.likeCount).toBe(1);
    });
  });

  describe('좋아요', () => {
    it('한 사람이 한 번이고, 두 번 눌러도 늘지 않는다', async () => {
      const user = await createUser();
      const viewer = await createUser();
      await createSchedule(user);
      const bragId = await bragService.publish(user.id);

      expect((await bragService.like(viewer.id, bragId)).likeCount).toBe(1);
      expect((await bragService.like(viewer.id, bragId)).likeCount).toBe(1);
    });

    it('취소하면 줄고, 0 아래로는 안 내려간다', async () => {
      const user = await createUser();
      const viewer = await createUser();
      await createSchedule(user);
      const bragId = await bragService.publish(user.id);

      await bragService.like(viewer.id, bragId);
      expect((await bragService.cancelLike(viewer.id, bragId)).likeCount).toBe(
        0,
      );
      expect((await bragService.cancelLike(viewer.id, bragId)).likeCount).toBe(
        0,
      );
    });

    /** 화면만 막으면 요청 한 번으로 자기 수를 올릴 수 있다 */
    it('자기 것에는 못 누른다', async () => {
      const user = await createUser();
      await createSchedule(user);
      const bragId = await bragService.publish(user.id);

      await expect(bragService.like(user.id, bragId)).rejects.toBeInstanceOf(
        ServiceError,
      );
    });

    it('내려간 글에는 못 누른다', async () => {
      const user = await createUser();
      const viewer = await createUser();
      await createSchedule(user);
      const bragId = await bragService.publish(user.id);
      await bragService.unpublish(user.id);

      await expect(bragService.like(viewer.id, bragId)).rejects.toBeInstanceOf(
        ServiceError,
      );
    });
  });

  describe('목록', () => {
    it('liked · isMine 은 요청한 사람 기준이다', async () => {
      const me = await createUser();
      const other = await createUser();
      await createSchedule(me);
      await createSchedule(other);
      await bragService.publish(me.id);
      const otherBragId = await bragService.publish(other.id);
      await bragService.like(me.id, otherBragId);

      const [list] = await bragService.getPlanBragList(me.id, {});
      const mine = list.find((row) => row.isMine);
      const theirs = list.find((row) => !row.isMine);

      expect(mine).toBeDefined();
      expect(mine?.liked).toBe(false);
      expect(theirs?.liked).toBe(true);
    });

    it('좋아요순은 많이 받은 것이 먼저다', async () => {
      const a = await createUser();
      const b = await createUser();
      const viewer = await createUser();
      await createSchedule(a);
      await createSchedule(b);
      await bragService.publish(a.id);
      const bBragId = await bragService.publish(b.id);
      await bragService.like(viewer.id, bBragId);

      const [list] = await bragService.getPlanBragList(viewer.id, {
        sort: PlanBragSort.LIKED,
      });

      expect(list[0].bragId).toBe(bBragId);
    });

    /**
     * 스냅샷이라고 D-24 를 박아 두면 반년 뒤에도 D-24 라고 적힌다.
     * 날짜는 저장하고 남은 일수는 읽을 때 다시 센다.
     */
    it('D-day 는 저장값이 아니라 읽을 때 다시 센다', async () => {
      const user = await createUser({ weddingDate: '2026-11-14' });
      await createSchedule(user);
      const bragId = await bragService.publish(user.id);

      const detail = await bragService.getPlanBragDetail(user.id, bragId);

      expect(detail.weddingDate).toBe('2026-11-14');
      const expected = Math.round(
        (Date.UTC(2026, 10, 14) -
          Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth(),
            new Date().getUTCDate(),
          )) /
          86_400_000,
      );
      expect(detail.dday).toBeCloseTo(expected, -1);
    });
  });
});

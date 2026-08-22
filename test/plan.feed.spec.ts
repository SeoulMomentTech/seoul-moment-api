import { ServiceError } from '@app/common/exception/service.error';
import {
  PlanFeedAuthorRole,
  PlanFeedSort,
  PlanFeedVoteValue,
} from '@app/repository/enum/plan-feed.enum';
import {
  PlanSchedulePayType,
  PlanScheduleStatus,
} from '@app/repository/enum/plan-schedule.enum';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { PlanFeedService } from 'apps/api/src/module/plen/feed/plan-feed.service';
import {
  daysUntilWedding,
  toRegion,
} from 'apps/api/src/module/plen/feed/plan-feed.util';
import { plainToInstance } from 'class-transformer';
import { DataSource } from 'typeorm';

import { getDataSource, truncateTables } from './setup/db.helper';
import { closeTestApp, getTestApp } from './setup/test-app';
import { PlanFeedPostEntity } from '../libs/repository/src/entity/plan-feed-post.entity';
import { PlanFeedVoteEntity } from '../libs/repository/src/entity/plan-feed-vote.entity';
import { PlanScheduleEntity } from '../libs/repository/src/entity/plan-schedule.entity';
import { PlanUserEntity } from '../libs/repository/src/entity/plan-user.entity';

describe('견적 후기 피드 (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let feedService: PlanFeedService;

  beforeAll(async () => {
    app = await getTestApp();
    dataSource = getDataSource(app);
    feedService = app.get(PlanFeedService);
  }, 60_000);

  afterEach(async () => {
    await truncateTables(dataSource, [
      'plan_feed_vote',
      'plan_feed_post',
      'plan_schedule',
      'plan_user_room_member',
      'plan_user_room',
      'plan_user',
    ]);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  async function createUser(
    weddingDate = '2026-12-31',
  ): Promise<PlanUserEntity> {
    return dataSource.getRepository(PlanUserEntity).save(
      plainToInstance(PlanUserEntity, {
        name: faker.person.firstName(),
        roomShareCode: faker.string.uuid(),
        budget: 1000,
        weddingDate,
      }),
    );
  }

  async function createSchedule(
    user: PlanUserEntity,
    override: Partial<PlanScheduleEntity> = {},
  ): Promise<PlanScheduleEntity> {
    return dataSource.getRepository(PlanScheduleEntity).save(
      plainToInstance(PlanScheduleEntity, {
        planUserId: user.id,
        categoryName: '스드메',
        title: '아뜰리에 진',
        payType: PlanSchedulePayType.CREDIT,
        amount: 385,
        location: '서울특별시 강남구 청담동 123-4 5층',
        status: PlanScheduleStatus.COMPLETED,
        ...override,
      }),
    );
  }

  const post = (user: PlanUserEntity, scheduleId: number, extra = {}) =>
    feedService.postPlanFeed(user.id, {
      scheduleId,
      rating: 5,
      body: '드레스 3벌 + 본식 스냅',
      isAmountPublic: true,
      authorRole: PlanFeedAuthorRole.BRIDE,
      ...extra,
    });

  // ── 주소 자르기 ──────────────────────────────────────────────────
  describe('주소는 시/구 까지만 남는다', () => {
    it.each([
      ['서울특별시 강남구 청담동 123-4 5층', '서울 강남구'],
      ['경기도 성남시 분당구 정자일로 95', '경기 성남시'],
      ['부산광역시 해운대구 우동', '부산 해운대구'],
      ['제주특별자치도 서귀포시 중문동', '제주 서귀포시'],
    ])('%s → %s', (input, expected) => {
      expect(toRegion(input)).toBe(expected);
    });

    it('시/도를 모르면 아무것도 남기지 않는다', () => {
      // "테헤란로 123 5층" 의 앞 두 조각을 그냥 내보내면 그게 곧 주소 유출이다
      expect(toRegion('테헤란로 123 5층')).toBeNull();
      expect(toRegion('')).toBeNull();
      expect(toRegion(null)).toBeNull();
    });
  });

  describe('D-day 는 KST 자정 기준이다', () => {
    it('한국 시간 오전 9시 전에도 하루가 어긋나지 않는다', () => {
      // 2026-08-23 00:30 KST = 2026-08-22 15:30 UTC
      const now = new Date('2026-08-22T15:30:00.000Z');
      expect(daysUntilWedding('2026-08-23', now)).toBe(0);
      expect(daysUntilWedding('2026-08-24', now)).toBe(1);
      expect(daysUntilWedding('2026-08-22', now)).toBe(-1);
    });

    it('날짜가 없으면 null 이다', () => {
      expect(daysUntilWedding(null)).toBeNull();
    });
  });

  // ── 올리기 ──────────────────────────────────────────────────────
  it('완료한 일정을 후기로 올리면 값이 일정에서 복사된다', async () => {
    // Given
    const user = await createUser();
    const schedule = await createSchedule(user);

    // When
    const created = await post(user, schedule.id);

    // Then
    expect(created.categoryName).toBe('스드메');
    expect(created.title).toBe('아뜰리에 진');
    expect(created.amount).toBe(385);
    expect(created.region).toBe('서울 강남구');
    expect(created.authorRole).toBe(PlanFeedAuthorRole.BRIDE);
    expect(created.authorDDay).toBe(daysUntilWedding('2026-12-31'));
  });

  it('클라이언트가 보낸 금액이 아니라 일정의 금액을 쓴다', async () => {
    // Given - 아무 숫자나 시세로 올릴 수 있으면 피드의 값어치가 무너진다
    const user = await createUser();
    const schedule = await createSchedule(user, { amount: 385 });

    // When
    const created = await post(user, schedule.id, { amount: 99999 });

    // Then
    expect(created.amount).toBe(385);
  });

  it('예정인 일정은 올릴 수 없다', async () => {
    // Given
    const user = await createUser();
    const schedule = await createSchedule(user, {
      status: PlanScheduleStatus.NORMAL,
    });

    // When / Then
    await expect(post(user, schedule.id)).rejects.toBeInstanceOf(ServiceError);
  });

  it('같은 일정을 두 번 올릴 수 없다', async () => {
    // Given
    const user = await createUser();
    const schedule = await createSchedule(user);
    await post(user, schedule.id);

    // When / Then
    await expect(post(user, schedule.id)).rejects.toBeInstanceOf(ServiceError);
  });

  it('남의 일정은 올릴 수 없다', async () => {
    // Given
    const owner = await createUser();
    const stranger = await createUser();
    const schedule = await createSchedule(owner);

    // When / Then
    await expect(post(stranger, schedule.id)).rejects.toBeInstanceOf(
      ServiceError,
    );
  });

  // ── 익명·비공개 ─────────────────────────────────────────────────
  it('응답에 작성자 id 가 실리지 않는다', async () => {
    // Given - id 가 실리면 같은 id 의 글을 모아 한 사람의 지출을 재구성할 수 있다
    const author = await createUser();
    const viewer = await createUser();
    const schedule = await createSchedule(author);
    await post(author, schedule.id);

    // When
    const [list] = await feedService.getPlanFeedList(viewer.id, {});

    // Then
    expect(list).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain(author.id);
    expect(list[0]).not.toHaveProperty('planUserId');
  });

  it('비공개 금액은 응답에서 필드 자체가 빠진다', async () => {
    // Given - null 이나 0 으로 내리면 클라이언트가 "0원" 으로 그린다
    const author = await createUser();
    const viewer = await createUser();
    const schedule = await createSchedule(author);
    await post(author, schedule.id, { isAmountPublic: false });

    // When
    const [list] = await feedService.getPlanFeedList(viewer.id, {});

    // Then - 클라이언트가 실제로 받는 JSON 을 본다. 클래스 필드라
    // 객체에는 키가 undefined 로 남지만 직렬화하면 사라진다.
    const wire = JSON.parse(JSON.stringify(list[0]));
    expect(wire).not.toHaveProperty('amount');
    expect(wire.isAmountPublic).toBe(false);
  });

  it('금액 범위로 거르면 비공개 글은 아예 걸리지 않는다', async () => {
    // Given - 범위에 들었다 나갔다 하는 것만으로 비공개 금액이 새어 나간다
    const author = await createUser();
    const viewer = await createUser();
    const open = await createSchedule(author, { amount: 385 });
    const secret = await createSchedule(author, {
      amount: 390,
      title: '비공개 업체',
    });
    await post(author, open.id, { isAmountPublic: true });
    await post(author, secret.id, { isAmountPublic: false });

    // When
    const [list] = await feedService.getPlanFeedList(viewer.id, {
      minAmount: 300,
      maxAmount: 500,
    });

    // Then
    expect(list.map((item) => item.title)).toEqual(['아뜰리에 진']);
  });

  // ── 목록·필터 ───────────────────────────────────────────────────
  it('카테고리와 지역으로 거른다', async () => {
    // Given
    const author = await createUser();
    const viewer = await createUser();
    const a = await createSchedule(author, { categoryName: '스드메' });
    const b = await createSchedule(author, {
      categoryName: '웨딩홀',
      title: 'SG 웨딩홀',
      location: '부산광역시 해운대구 우동 1',
    });
    await post(author, a.id);
    await post(author, b.id);

    // When
    const [byCategory] = await feedService.getPlanFeedList(viewer.id, {
      category: '웨딩홀',
    });
    const [bySeoul] = await feedService.getPlanFeedList(viewer.id, {
      region: '서울',
    });

    // Then
    expect(byCategory.map((item) => item.title)).toEqual(['SG 웨딩홀']);
    expect(bySeoul.map((item) => item.title)).toEqual(['아뜰리에 진']);
  });

  it('내린 후기는 목록에 없다', async () => {
    // Given
    const author = await createUser();
    const viewer = await createUser();
    const schedule = await createSchedule(author);
    const created = await post(author, schedule.id);

    // When
    await feedService.deletePlanFeed(author.id, created.id);

    // Then
    const [list] = await feedService.getPlanFeedList(viewer.id, {});
    expect(list).toHaveLength(0);
  });

  it('남의 후기는 내릴 수 없다', async () => {
    // Given
    const author = await createUser();
    const stranger = await createUser();
    const schedule = await createSchedule(author);
    const created = await post(author, schedule.id);

    // When / Then
    await expect(
      feedService.deletePlanFeed(stranger.id, created.id),
    ).rejects.toBeInstanceOf(ServiceError);
  });

  // ── 도움이 돼요 / 안 돼요 ────────────────────────────────────────
  const HELPFUL = PlanFeedVoteValue.HELPFUL;
  const NOT_HELPFUL = PlanFeedVoteValue.NOT_HELPFUL;

  it('도움이 돼요를 누르면 개수가 오르고 내 평가가 붙는다', async () => {
    // Given
    const author = await createUser();
    const viewer = await createUser();
    const schedule = await createSchedule(author);
    const created = await post(author, schedule.id);

    // When
    const result = await feedService.votePlanFeed(
      viewer.id,
      created.id,
      HELPFUL,
    );

    // Then
    expect(result).toEqual({ myVote: HELPFUL, helpfulCount: 1 });
    const [list] = await feedService.getPlanFeedList(viewer.id, {});
    expect(list[0].myVote).toBe(HELPFUL);
    expect(list[0].helpfulCount).toBe(1);
  });

  it('같은 값을 다시 누르면 취소된다', async () => {
    // Given
    const author = await createUser();
    const viewer = await createUser();
    const schedule = await createSchedule(author);
    const created = await post(author, schedule.id);
    await feedService.votePlanFeed(viewer.id, created.id, HELPFUL);

    // When
    const again = await feedService.votePlanFeed(
      viewer.id,
      created.id,
      HELPFUL,
    );

    // Then
    expect(again).toEqual({ myVote: null, helpfulCount: 0 });
  });

  it('마음을 바꾸면 표가 늘지 않고 값만 뒤집힌다', async () => {
    // Given - 한 사람이 한 표라는 규칙이 유지되어야 한다
    const author = await createUser();
    const viewer = await createUser();
    const schedule = await createSchedule(author);
    const created = await post(author, schedule.id);
    await feedService.votePlanFeed(viewer.id, created.id, HELPFUL);

    // When
    const flipped = await feedService.votePlanFeed(
      viewer.id,
      created.id,
      NOT_HELPFUL,
    );

    // Then
    expect(flipped).toEqual({ myVote: NOT_HELPFUL, helpfulCount: 0 });
    const rows = await dataSource
      .getRepository(PlanFeedVoteEntity)
      .find({ where: { postId: created.id, planUserId: viewer.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe(NOT_HELPFUL);
  });

  it('"도움이 안 돼요" 수는 응답에 담기지 않는다', async () => {
    // Given - 공개하면 정직하게 올린 사람이 다음부터 안 올린다
    const author = await createUser();
    const a = await createUser();
    const b = await createUser();
    const schedule = await createSchedule(author);
    const created = await post(author, schedule.id);
    await feedService.votePlanFeed(a.id, created.id, NOT_HELPFUL);
    await feedService.votePlanFeed(b.id, created.id, NOT_HELPFUL);

    // When
    const [list] = await feedService.getPlanFeedList(author.id, {});

    // Then
    const wire = JSON.parse(JSON.stringify(list[0]));
    expect(wire).not.toHaveProperty('notHelpfulCount');
    expect(wire.helpfulCount).toBe(0);
    // 내부 값은 제대로 쌓여 있어야 정렬이 동작한다
    const row = await dataSource
      .getRepository(PlanFeedPostEntity)
      .findOneByOrFail({ id: created.id });
    expect(row.notHelpfulCount).toBe(2);
  });

  it('취소하면 개수가 줄고, 누른 적 없으면 그대로다', async () => {
    // Given
    const author = await createUser();
    const viewer = await createUser();
    const other = await createUser();
    const schedule = await createSchedule(author);
    const created = await post(author, schedule.id);
    await feedService.votePlanFeed(viewer.id, created.id, HELPFUL);

    // When
    const cancelled = await feedService.cancelPlanFeedVote(
      viewer.id,
      created.id,
    );
    const never = await feedService.cancelPlanFeedVote(other.id, created.id);

    // Then
    expect(cancelled).toEqual({ myVote: null, helpfulCount: 0 });
    expect(never).toEqual({ myVote: null, helpfulCount: 0 });
  });

  it('도움순은 "안 돼요"를 뺀 값으로 센다', async () => {
    // Given - 돼요만 세면 쓸모없는 후기도 노출만 많으면 위로 올라온다.
    //         시끄러운 곳은 돼요가 더 많지만(3 vs 2) 안 돼요도 3 이라 0 점이다.
    const author = await createUser();
    const voters = await Promise.all(
      Array.from({ length: 6 }, () => createUser()),
    );
    const noisy = await createSchedule(author, { title: '시끄러운 곳' });
    const solid = await createSchedule(author, { title: '쓸모 있는 곳' });
    const noisyPost = await post(author, noisy.id);
    const solidPost = await post(author, solid.id);

    for (const v of voters.slice(0, 3)) {
      await feedService.votePlanFeed(v.id, noisyPost.id, HELPFUL);
    }
    for (const v of voters.slice(3, 6)) {
      await feedService.votePlanFeed(v.id, noisyPost.id, NOT_HELPFUL);
    }
    for (const v of voters.slice(0, 2)) {
      await feedService.votePlanFeed(v.id, solidPost.id, HELPFUL);
    }

    // When
    const [list] = await feedService.getPlanFeedList(author.id, {
      sort: PlanFeedSort.HELPFUL,
    });

    // Then - 돼요가 적은 쪽이 위로 온다
    expect(list.map((item) => item.title)).toEqual([
      '쓸모 있는 곳',
      '시끄러운 곳',
    ]);
    expect(list[0].helpfulCount).toBe(2);
    expect(list[1].helpfulCount).toBe(3);

    const noisyRow = await dataSource
      .getRepository(PlanFeedPostEntity)
      .findOneByOrFail({ id: noisyPost.id });
    expect(noisyRow.notHelpfulCount).toBe(3);
  });

  // ── 사이드 패널 ─────────────────────────────────────────────────
  it('아직 안 올린 완료 일정만 "올릴 수 있는 일정"이다', async () => {
    // Given
    const user = await createUser();
    const done = await createSchedule(user, { title: '올린 것' });
    await createSchedule(user, { title: '아직 안 올린 것' });
    await createSchedule(user, {
      title: '예정',
      status: PlanScheduleStatus.NORMAL,
    });
    await post(user, done.id);

    // When
    const postable = await feedService.getPostableSchedules(user.id);

    // Then
    expect(postable.map((item) => item.title)).toEqual(['아직 안 올린 것']);
  });

  it('내 후기 현황은 올린 수·받은 하트·남은 일정을 센다', async () => {
    // Given
    const user = await createUser();
    const reader = await createUser();
    const a = await createSchedule(user, { title: 'A' });
    await createSchedule(user, { title: 'B' });
    const created = await post(user, a.id);
    await feedService.votePlanFeed(reader.id, created.id, HELPFUL);

    // When
    const status = await feedService.getMyStatus(user.id);

    // Then
    expect(status).toEqual({
      postCount: 1,
      receivedHelpfulCount: 1,
      postableScheduleCount: 1,
    });
  });
});

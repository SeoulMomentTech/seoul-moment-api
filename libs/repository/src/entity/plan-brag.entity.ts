import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { PlanUserEntity } from './plan-user.entity';
import { PlanBragStatus } from '../enum/plan-brag.enum';

/** 자랑하기 상세에 실리는 플랜 한 줄. 올릴 때 그대로 복사해 둔다 */
export interface PlanBragItemSnapshot {
  id: number;
  categoryName: string;
  title: string;
  /** 만원 단위. 안 정했으면 null */
  amount: number | null;
  /** 'YYYY-MM-DD'. 날짜 미정이면 null */
  startDate: string | null;
  /** 'COMPLETED' 면 완료, 그 밖은 예정 */
  status: string;
}

/** 예산 막대·범례용 카테고리 집계. 지출 큰 순으로 담는다 */
export interface PlanBragCategorySnapshot {
  categoryName: string;
  /** 실제 지출 (만원) */
  usedAmount: number;
}

/**
 * 자랑하기 — 내 웨딩 플랜 한 장.
 *
 * 단위가 **플랜 전체**다. 일정 하나를 올리는 일은 피드(견적 후기)가 이미
 * 맡고 있고, 여기는 대시보드 토글 한 번으로 플랜이 통째로 올라간다.
 *
 * **피드와 규칙이 정반대다.** 피드는 응답에 planUserId 조차 싣지 않는 철저한
 * 익명인데, 자랑하기는 **이름을 내는 것이 목적**이다. 두 모듈의 코드를 서로
 * 베낄 때 여기서 가장 먼저 사고가 난다 — 피드에 이름을 흘리거나, 자랑하기에
 * 익명 처리를 넣거나.
 *
 * **값을 참조하지 않고 복사해 둔다.** "올린 뒤에는 고칠 수 없다" 가 이 기능이
 * 사용자에게 한 약속이다. 플랜을 참조만 하면 올린 뒤에 예산을 고쳐도 남의
 * 화면이 따라 바뀌어 약속이 깨진다. 그래서 올리는 순간의 스냅샷을 통째로
 * 들고 있는다 — 고치려면 내렸다가 다시 올린다.
 *
 * **한 사람이 한 장만 갖는다** (plan_user_id 유니크). 플랜 전체가 단위라 여러
 * 장이 있을 이유가 없고, 토글이라 "지금 올라가 있나" 가 상태의 전부다.
 *
 * 공개 범위는 앱의 안내 모달(`BragToggle` 의 OPEN_FIELDS)이 글자 그대로
 * 약속한다 — 닉네임 · 결혼식 날짜 · 총예산 · 카테고리별 지출과 소계 ·
 * 일정 제목 · 일정별 금액. **그 목록에 없는 것을 여기 담지 말 것.** 특히
 * 일정의 시각(startTime)과 장소(location)는 담지 않는다 — 장소는 카카오에서
 * 고르면 업체명이 그대로 들어가는 자리라 공개 범위가 조용히 넓어진다.
 */
@Index(['status', 'publishedAt'])
@Index(['status', 'likeCount'])
@Index('uq_plan_brag_user', ['planUserId'], { unique: true })
@Entity('plan_brag')
export class PlanBragEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', {
    name: 'plan_user_id',
    nullable: false,
    comment: '올린 사람. 익명이 아니라 이름을 내는 것이 목적이다',
  })
  planUserId: string;

  @Column('varchar', {
    length: 255,
    nullable: false,
    comment: '"지수 · 현우". 배우자가 있으면 두 이름, 없으면 한 이름',
  })
  nickname: string;

  @Column('date', {
    name: 'wedding_date',
    nullable: true,
    comment: 'D-day 는 저장하지 않고 읽을 때 이 값으로 다시 센다',
  })
  weddingDate: Date | null;

  @Column('int', {
    name: 'total_budget',
    nullable: false,
    default: 0,
    comment: '총예산 (만원)',
  })
  totalBudget: number;

  @Column('int', {
    name: 'used_amount',
    nullable: false,
    default: 0,
    comment: '실제 지출 (만원)',
  })
  usedAmount: number;

  @Column('int', {
    name: 'planned_amount',
    nullable: false,
    default: 0,
    comment: '아직 안 쓴 예정 몫 (만원)',
  })
  plannedAmount: number;

  @Column('int', {
    name: 'plan_count',
    nullable: false,
    default: 0,
  })
  planCount: number;

  @Column('int', {
    name: 'done_count',
    nullable: false,
    default: 0,
  })
  doneCount: number;

  @Column('json', {
    nullable: false,
    comment: '목록 카드의 칩. 지출 큰 순 카테고리 이름',
  })
  categories: string[];

  @Column('json', {
    name: 'category_chart',
    nullable: false,
    comment: '상세의 예산 막대·범례. 지출 큰 순',
  })
  categoryChart: PlanBragCategorySnapshot[];

  @Column('json', {
    nullable: false,
    comment:
      '플랜 전체를 평평한 목록으로. 카테고리로 묶고 소계를 내는 일은 앱이 한다 — ' +
      '소계는 지출과 예정을 함께 세야 하는데(완료 185 + 예정 35 = 220), ' +
      '그 규칙을 서버에 두면 문구 하나 고치는 데 배포가 묶인다',
  })
  items: PlanBragItemSnapshot[];

  @Column('int', {
    name: 'like_count',
    nullable: false,
    default: 0,
    comment: '비정규화. plan_brag_like 행과 같은 트랜잭션에서 올린다',
  })
  likeCount: number;

  @Column('timestamp', {
    name: 'published_at',
    nullable: true,
    comment:
      '마지막으로 올린 시각. 최신순 정렬의 기준이다 — create_date 로 정렬하면 ' +
      '내렸다 다시 올린 플랜이 목록 아래에 그대로 묻힌다',
  })
  publishedAt: Date | null;

  @Column('enum', {
    enum: PlanBragStatus,
    nullable: false,
    default: PlanBragStatus.PUBLISHED,
  })
  status: PlanBragStatus;

  @ManyToOne(() => PlanUserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_user_id' })
  planUser: PlanUserEntity;
}

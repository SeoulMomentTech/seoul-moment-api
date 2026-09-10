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

/**
 * 자랑하기 — 내 웨딩 플랜 한 장을 목록에 올린 상태.
 *
 * 단위가 **플랜 전체**다. 일정 하나를 올리는 일은 피드(견적 후기)가 이미
 * 맡고 있고, 여기는 대시보드 토글 한 번으로 플랜이 통째로 올라간다.
 *
 * **피드와 규칙이 정반대다.** 피드는 응답에 planUserId 조차 싣지 않는 철저한
 * 익명인데, 자랑하기는 **이름을 내는 것이 목적**이다. 두 모듈의 코드를 서로
 * 베낄 때 여기서 가장 먼저 사고가 난다 — 피드에 이름을 흘리거나, 자랑하기에
 * 익명 처리를 넣거나.
 *
 * ── 이 행에는 "올렸다" 는 사실만 있다 ────────────────────────
 * 예산·개수·카테고리·플랜 목록을 **저장하지 않는다.** 목록과 상세는 볼 때마다
 * 그 사람의 지금 플랜에서 새로 만든다.
 *
 * 처음에는 올리는 순간의 스냅샷을 통째로 복사해 뒀는데, 그게 틀렸다. 켜 둔
 * 뒤에 일정을 고치거나 장소를 더해도 자랑하기는 얼어붙은 채로 남아서, 고치려면
 * 토글을 껐다 켜야 한다는 것을 사람이 알 방법이 없었다. **"수정하지 못하고
 * 볼 수만 있다" 는 보는 사람 이야기이지 올린 사람 이야기가 아니다.**
 *
 * 그래서 남는 것은 네 가지다 — 누가(planUserId), 언제부터(publishedAt),
 * 지금 올라가 있는지(status), 받은 좋아요(likeCount).
 *
 * ── 공개 범위 ───────────────────────────────────────────────
 * 앱의 안내 모달(`BragToggle` 의 OPEN_FIELDS)이 글자 그대로 약속한다 —
 * 닉네임 · 결혼식 날짜 · 총예산 · 카테고리별 지출과 소계 · 일정 제목 ·
 * 일정별 금액 · 일정 장소. **그 목록에 없는 것을 응답에 싣지 말 것.**
 * 특히 일정의 **시각(startTime)과 메모(memo)** 는 내보내지 않는다
 * (`plan-brag.service.ts` 의 `toItemView`).
 *
 * **한 사람이 한 장만 갖는다** (plan_user_id 유니크). 플랜 전체가 단위라 여러
 * 장이 있을 이유가 없고, 토글이라 "지금 올라가 있나" 가 상태의 전부다.
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

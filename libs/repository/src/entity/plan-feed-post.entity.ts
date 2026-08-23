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
import { PlanFeedAuthorRole, PlanFeedPostStatus } from '../enum/plan-feed.enum';

/**
 * 견적 후기. 피드의 글 하나다.
 *
 * **완료한 일정을 그대로 옮겨 담는 게 기본 경로다.** 결혼 준비에서 가장
 * 희소한 정보가 "남들은 얼마 썼나" 인데, 그 값이 이미 plan_schedule 에
 * 들어 있다. 그래서 글을 새로 쓰게 하지 않고 있는 값에 별점과 한 줄만
 * 얹어 올린다.
 *
 * **일정을 참조만 하지 않고 값을 복사해 둔다.** 일정은 지워지거나 금액이
 * 바뀔 수 있는데, 후기는 "그때 그 값으로 이랬다" 는 기록이라 따라 바뀌면
 * 안 된다. sourceScheduleId 는 중복 등록을 막는 용도다.
 */
@Index(['status', 'createDate'])
@Index(['status', 'categoryName', 'createDate'])
@Index(['planUserId', 'createDate'])
@Index(['placeId'])
@Entity('plan_feed_post')
export class PlanFeedPostEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', {
    name: 'plan_user_id',
    nullable: false,
    comment: '올린 사람. 익명 피드라 응답에는 절대 싣지 않는다',
  })
  planUserId: string;

  @Column('int', {
    name: 'source_schedule_id',
    nullable: true,
    comment: '어느 일정에서 옮겼는지. 같은 일정을 두 번 올리지 못하게 막는다',
  })
  sourceScheduleId: number | null;

  @Column('varchar', { length: 255, nullable: false })
  categoryName: string;

  @Column('varchar', { length: 255, nullable: false, comment: '업체명' })
  title: string;

  @Column('int', { nullable: true, comment: '실제 지출 (만원 단위)' })
  amount: number | null;

  @Column('boolean', {
    name: 'is_amount_public',
    nullable: false,
    default: true,
    comment: '거짓이면 응답에서 amount 를 아예 뺀다',
  })
  isAmountPublic: boolean;

  @Column('varchar', {
    length: 60,
    nullable: true,
    comment: '시/구 까지만. 필터·집계용. address 에서 잘라 만든다',
  })
  region: string | null;

  @Column('varchar', {
    length: 255,
    nullable: true,
    comment: '도로명 주소. 카카오 장소를 고른 경우에만 있다',
  })
  address: string | null;

  @Column('varchar', {
    name: 'place_id',
    length: 40,
    nullable: true,
    comment:
      '카카오 장소 id. 같은 업체 후기를 묶는 유일한 열쇠다 — ' +
      '업체명은 자유 문자열이라 "SG웨딩홀"과 "sg 웨딩홀"이 서로 다른 업체가 된다',
  })
  placeId: string | null;

  @Column('decimal', { precision: 11, scale: 8, nullable: true })
  lat: number | null;

  @Column('decimal', { precision: 11, scale: 8, nullable: true })
  lng: number | null;

  @Column('smallint', { nullable: false, default: 0, comment: '만족도 1~5' })
  rating: number;

  @Column('text', { nullable: true, comment: '한 줄 후기' })
  body: string | null;

  @Column('int', {
    name: 'author_d_day',
    nullable: true,
    comment: '올린 시점의 남은 일수. 지난 결혼식이면 음수',
  })
  authorDDay: number | null;

  @Column('enum', {
    enum: PlanFeedAuthorRole,
    nullable: false,
    default: PlanFeedAuthorRole.UNKNOWN,
  })
  authorRole: PlanFeedAuthorRole;

  @Column('int', {
    name: 'helpful_count',
    nullable: false,
    default: 0,
    comment: '비정규화. 평가와 같은 트랜잭션에서 올린다',
  })
  helpfulCount: number;

  @Column('int', {
    name: 'not_helpful_count',
    nullable: false,
    default: 0,
    comment:
      '바깥에 내보내지 않는다. 정렬(도움순)과 어뷰징 감지에만 쓰는 내부 값',
  })
  notHelpfulCount: number;

  @Column('enum', {
    enum: PlanFeedPostStatus,
    nullable: false,
    default: PlanFeedPostStatus.PUBLISHED,
  })
  status: PlanFeedPostStatus;

  @ManyToOne(() => PlanUserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_user_id' })
  planUser: PlanUserEntity;
}

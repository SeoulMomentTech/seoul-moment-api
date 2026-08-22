import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { PlanFeedPostEntity } from './plan-feed-post.entity';
import { PlanUserEntity } from './plan-user.entity';
import { PlanFeedVoteValue } from '../enum/plan-feed.enum';

/**
 * 후기 평가 — 도움이 돼요 / 도움이 안 돼요.
 *
 * 한 사람이 한 글에 하나만 갖는다. 마음을 바꾸면 값이 뒤집힐 뿐 행이 늘지
 * 않는다. 서비스에서도 막지만 유니크 인덱스로 DB 에서도 막는다 — 연타나
 * 동시 요청은 서비스 검사만으로는 새는 자리다.
 *
 * 개수는 plan_feed_post 에 비정규화해 두고 같은 트랜잭션에서 함께 쓴다.
 * 목록마다 COUNT 를 돌리면 도움순 정렬이 통째로 느려진다.
 */
@Index('uq_plan_feed_vote', ['postId', 'planUserId'], { unique: true })
@Index(['planUserId'])
@Entity('plan_feed_vote')
export class PlanFeedVoteEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'post_id', nullable: false })
  postId: number;

  @Column('varchar', { name: 'plan_user_id', nullable: false })
  planUserId: string;

  @Column('enum', { enum: PlanFeedVoteValue, nullable: false })
  value: PlanFeedVoteValue;

  @ManyToOne(() => PlanFeedPostEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: PlanFeedPostEntity;

  @ManyToOne(() => PlanUserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_user_id' })
  planUser: PlanUserEntity;
}

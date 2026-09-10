import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { PlanBragEntity } from './plan-brag.entity';
import { PlanUserEntity } from './plan-user.entity';

/**
 * 자랑하기 좋아요.
 *
 * 한 사람이 한 글에 하나만 갖는다. 서비스에서도 막지만 **유니크 인덱스로 DB
 * 에서도 막는다** — 연타나 동시 요청은 서비스 검사만으로는 새는 자리다
 * (plan_feed_vote 와 같은 이유, 같은 처리).
 *
 * 개수는 plan_brag.like_count 에 비정규화해 두고 같은 트랜잭션에서 함께 쓴다.
 * 목록마다 COUNT 를 돌리면 좋아요순 정렬이 통째로 느려진다.
 *
 * **행을 지우지 않는 쪽이 브래그 본체다.** 브래그를 내렸다 다시 올려도 이
 * 행들은 그대로 남아 좋아요가 이어진다 (plan-brag.enum 의 UNPUBLISHED 주석).
 */
@Index('uq_plan_brag_like', ['bragId', 'planUserId'], { unique: true })
@Index(['planUserId'])
@Entity('plan_brag_like')
export class PlanBragLikeEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'brag_id', nullable: false })
  bragId: number;

  @Column('varchar', { name: 'plan_user_id', nullable: false })
  planUserId: string;

  @ManyToOne(() => PlanBragEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brag_id' })
  brag: PlanBragEntity;

  @ManyToOne(() => PlanUserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_user_id' })
  planUser: PlanUserEntity;
}

import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { PlanUserRoomEntity } from './plan-user-room.entity';
import { PlanUserEntity } from './plan-user.entity';
import {
  PlanActivityTargetType,
  PlanActivityType,
} from '../enum/plan-activity.enum';

/**
 * 플랜에서 일어난 일의 기록. 홈 화면의 "최근 활동"이 읽는다.
 *
 * 대상(스케줄 등)이 지워져도 문장이 비지 않도록 제목·금액을 기록 시점 값으로
 * 함께 저장한다. 반대로 사람 이름은 저장하지 않고 planUser 를 조인해서 읽는다.
 * 이름은 바뀔 수 있고, 바뀌면 과거 기록도 새 이름으로 보이는 편이 자연스럽다.
 */
@Index(['planUserRoomId', 'createDate'])
@Index(['planUserId', 'createDate'])
@Entity('plan_activity')
export class PlanActivityEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('enum', { enum: PlanActivityType, nullable: false })
  type: PlanActivityType;

  @Column('varchar', {
    name: 'plan_user_id',
    nullable: false,
    comment: '이 일을 한 사람',
  })
  planUserId: string;

  @Column('int', {
    name: 'plan_user_room_id',
    nullable: true,
    comment: '공유 방. 없으면 개인 플랜의 기록',
  })
  planUserRoomId: number | null;

  @Column('enum', {
    enum: PlanActivityTargetType,
    nullable: true,
  })
  targetType: PlanActivityTargetType | null;

  @Column('int', { nullable: true, comment: '대상 id (스케줄 id 등)' })
  targetId: number | null;

  @Column('varchar', {
    length: 255,
    nullable: true,
    comment: '대상 이름. 기록 시점 값이라 대상이 지워져도 남는다',
  })
  targetTitle: string | null;

  @Column('int', {
    nullable: true,
    comment: '금액 (만원 단위). 예산 변경·지출 플랜에서 쓴다',
  })
  amount: number | null;

  @ManyToOne(() => PlanUserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_user_id' })
  planUser: PlanUserEntity;

  @ManyToOne(() => PlanUserRoomEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_user_room_id' })
  planUserRoom: PlanUserRoomEntity;
}

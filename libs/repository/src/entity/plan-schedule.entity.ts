import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { PlanUserRoomEntity } from './plan-user-room.entity';
import { PlanUserEntity } from './plan-user.entity';
import {
  PlanSchedulePayType,
  PlanScheduleStatus,
} from '../enum/plan-schedule.enum';

@Entity('plan_schedule')
export class PlanScheduleEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'plan_user_id', nullable: false })
  planUserId: string;

  @Column('int', { name: 'plan_user_room_id', nullable: true })
  planUserRoomId: number;

  @Column('varchar', { length: 255, nullable: false })
  categoryName: string;

  @Column('varchar', { length: 255, nullable: false })
  title: string;

  @Column('enum', {
    enum: PlanSchedulePayType,
    nullable: false,
    default: PlanSchedulePayType.OTHER,
  })
  payType: PlanSchedulePayType;

  @Column('int', { nullable: true })
  amount: number;

  @Column('date', { nullable: true })
  startDate: Date;

  /**
   * 시작 시각 'HH:mm'. startDate 를 timestamp 로 바꾸지 않고 따로 둔다 —
   * 이미 쌓인 date 값을 옮기는 마이그레이션 없이 시각만 더할 수 있고,
   * "날짜만 정하고 시간은 아직" 인 일정을 그대로 표현할 수 있다.
   */
  @Column('varchar', { length: 5, nullable: true, comment: '시작 시각 HH:mm' })
  startTime: string;

  @Column('varchar', { length: 255, nullable: true })
  location: string;

  @Column('decimal', { precision: 11, scale: 8, nullable: true })
  locationLat: number;

  @Column('decimal', { precision: 11, scale: 8, nullable: true })
  locationLng: number;

  @Column('text', { nullable: true })
  memo: string;

  /**
   * 돈이 나갔는가. **일정이 끝났는가(`status`)와 다른 축이다.**
   *
   * 예식장 계약금을 미리 내고 예식은 내년인 경우가 흔한데, 예전에는 축이
   * 하나뿐이라 그 돈이 "예정" 으로 잡혔다 — 이미 통장에서 빠져나간 돈이
   * 예산에 안 잡혔다. 반대로 끝났는데 아직 정산 안 한 경우도 있다.
   *
   * **`null` 은 "예전 데이터" 라는 뜻이다.** 이 컬럼이 생기기 전에는 완료가
   * 곧 결제였으므로, 값이 없으면 `status === COMPLETED` 로 읽는다
   * (`isSchedulePaid` / `PAID_SQL`). 그래야 쌓여 있는 일정을 건드리지 않고도
   * 예산이 예전과 똑같이 나온다 — 마이그레이션이 필요 없는 이유다.
   * **`false` 와 `null` 을 같게 다루지 말 것.**
   */
  @Column('boolean', {
    name: 'is_paid',
    nullable: true,
    comment: '결제 완료 여부. null 이면 status=COMPLETED 로 판단한다',
  })
  isPaid: boolean | null;

  @Column('enum', {
    enum: PlanScheduleStatus,
    nullable: false,
    default: PlanScheduleStatus.NORMAL,
  })
  status: PlanScheduleStatus;

  @ManyToOne(() => PlanUserEntity, (planUser) => planUser.schedules, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'plan_user_id' })
  planUser: PlanUserEntity;

  @ManyToOne(() => PlanUserRoomEntity, (room) => room.schedules, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'plan_user_room_id' })
  planUserRoom: PlanUserRoomEntity;
}

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

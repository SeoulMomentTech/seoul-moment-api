import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
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
}

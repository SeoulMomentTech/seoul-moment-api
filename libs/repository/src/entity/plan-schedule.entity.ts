import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { PlanUserEntity } from './plan-user.entity';

@Entity('plan_schedule')
export class PlanScheduleEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'plan_user_id', nullable: false })
  planUserId: string;

  @ManyToOne(() => PlanUserEntity, (planUser) => planUser.schedules, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'plan_user_id' })
  planUser: PlanUserEntity;
}

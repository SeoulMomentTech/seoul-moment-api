import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CommonEntity } from './common.entity';
import { PlanScheduleEntity } from './plan-schedule.entity';
import { PlanUserRoomMemberEntity } from './plan-user-room-member.entity';
import { PlanUserEntity } from './plan-user.entity';

@Entity('plan_user_room')
export class PlanUserRoomEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', { name: 'owner_id', nullable: false })
  ownerId: string;

  @OneToOne(() => PlanUserEntity, (planUser) => planUser.room, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'owner_id' })
  owner: PlanUserEntity;

  @Column('varchar', { nullable: false })
  shareCode: string;

  @OneToMany(() => PlanUserRoomMemberEntity, (member) => member.room)
  members: PlanUserRoomMemberEntity[];

  @OneToMany(() => PlanScheduleEntity, (schedule) => schedule.planUserRoom, {
    cascade: true,
  })
  schedules: PlanScheduleEntity[];
}

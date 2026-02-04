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

@Entity('plan_user_room_member')
export class PlanUserRoomMemberEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', { name: 'room_id', nullable: false })
  roomId: string;

  @Column('varchar', { name: 'plan_user_id', nullable: false })
  planUserId: string;

  @ManyToOne(() => PlanUserRoomEntity, (room) => room.members)
  @JoinColumn({ name: 'room_id' })
  room: PlanUserRoomEntity;

  @ManyToOne(() => PlanUserEntity, (planUser) => planUser.members)
  @JoinColumn({ name: 'plan_user_id' })
  planUser: PlanUserEntity;
}

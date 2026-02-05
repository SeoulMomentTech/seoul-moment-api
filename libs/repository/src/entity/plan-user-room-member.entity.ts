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
import { PlanUserRoomMemberPermission } from '../enum/plan-user-room-member.enum';

@Entity('plan_user_room_member')
export class PlanUserRoomMemberEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'room_id', nullable: false })
  roomId: number;

  @Column('varchar', { name: 'plan_user_id', nullable: false })
  planUserId: string;

  @Column('enum', {
    enum: PlanUserRoomMemberPermission,
    nullable: false,
    default: PlanUserRoomMemberPermission.READ,
  })
  permission: PlanUserRoomMemberPermission;

  @ManyToOne(() => PlanUserRoomEntity, (room) => room.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'room_id' })
  room: PlanUserRoomEntity;

  @ManyToOne(() => PlanUserEntity, (planUser) => planUser.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'plan_user_id' })
  planUser: PlanUserEntity;
}

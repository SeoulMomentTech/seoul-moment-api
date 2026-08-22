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
import { PlanUserRoomMemberPermission } from '../enum/plan-user-room-member.enum';

/**
 * 배우자는 방마다 한 명뿐이다. 서비스에서도 막지만, 동시 요청으로 둘이
 * 생기는 걸 DB 에서도 끊는다.
 */
@Index('uq_plan_user_room_member_spouse', ['roomId'], {
  unique: true,
  where: `permission = 'SPOUSE'`,
})
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

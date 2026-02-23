import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ChatRoomEntity } from './chat-room.entity';
import { CommonEntity } from './common.entity';
import { PlanUserEntity } from './plan-user.entity';

@Entity('chat_room_member')
export class ChatRoomMemberEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'chat_room_id', nullable: false })
  chatRoomId: number;

  @Column('varchar', { name: 'plan_user_id', nullable: false })
  planUserId: string;

  @Column('int', { default: 0, nullable: false })
  lastReadMessageId: number;

  @ManyToOne(() => ChatRoomEntity, (chatRoom) => chatRoom.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'chat_room_id' })
  chatRoom: ChatRoomEntity;

  @ManyToOne(() => PlanUserEntity, (planUser) => planUser.chatRoomMembers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'plan_user_id' })
  planUser: PlanUserEntity;
}

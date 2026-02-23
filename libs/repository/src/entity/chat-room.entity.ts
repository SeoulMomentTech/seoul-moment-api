import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ChatMessageEntity } from './chat-message.entity';
import { ChatRoomMemberEntity } from './chat-room-member.entity';
import { CommonEntity } from './common.entity';
import { PlanUserRoomEntity } from './plan-user-room.entity';

@Entity('chat_room')
export class ChatRoomEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'plan_user_room_id', nullable: false })
  planUserRoomId: number;

  @Column('varchar', { length: 255, nullable: true })
  name: string;

  @ManyToOne(
    () => PlanUserRoomEntity,
    (planUserRoom) => planUserRoom.chatRooms,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'plan_user_room_id' })
  planUserRoom: PlanUserRoomEntity;

  @OneToMany(() => ChatRoomMemberEntity, (member) => member.chatRoom)
  members: ChatRoomMemberEntity[];

  @OneToMany(() => ChatMessageEntity, (message) => message.chatRoom)
  messages: ChatMessageEntity[];
}

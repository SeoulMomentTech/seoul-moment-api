import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ChatRoomEntity } from './chat-room.entity';
import { CommonEntity } from './common.entity';
import { PlanUserEntity } from './plan-user.entity';
import { ChatMessageObject } from '../dto/chat-message.dto';
import { ChatMessageType } from '../enum/chat-message.enum';

@Index(['chatRoomId', 'messageType'])
@Entity('chat_message')
export class ChatMessageEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'chat_room_id', nullable: false })
  chatRoomId: number;

  @Column('varchar', { name: 'plan_user_id', nullable: false })
  planUserId: string;

  @Column('json', {
    nullable: false,
    comment: '메시지 내용 (text, scheduleId)',
  })
  message: ChatMessageObject;

  @Column('enum', {
    enum: ChatMessageType,
    default: ChatMessageType.TEXT,
    nullable: false,
  })
  messageType: ChatMessageType;

  @ManyToOne(() => ChatRoomEntity, (chatRoom) => chatRoom.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'chat_room_id' })
  chatRoom: ChatRoomEntity;

  @ManyToOne(() => PlanUserEntity, (planUser) => planUser.chatMessages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'plan_user_id' })
  planUser: PlanUserEntity;
}

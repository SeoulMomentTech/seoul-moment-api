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
import { ChatMessageObject } from '../dto/chat-message.dto';
import { ChatMessageType } from '../enum/chat-message.enum';

@Index(['roomId', 'messageType'])
@Entity('chat_message')
export class ChatMessageEntity extends CommonEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('int', { name: 'room_id', nullable: false })
  roomId: number;

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

  @ManyToOne(() => PlanUserRoomEntity, (room) => room.chatMessages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'room_id' })
  room: PlanUserRoomEntity;

  @ManyToOne(() => PlanUserEntity, (planUser) => planUser.chatMessages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'plan_user_id' })
  planUser: PlanUserEntity;
}

import { plainToInstance } from 'class-transformer';

import { ChatMessageEntity } from '../entity/chat-message.entity';
import { PlanScheduleEntity } from '../entity/plan-schedule.entity';
import { ChatMessageType } from '../enum/chat-message.enum';
import { PlanScheduleStatus } from '../enum/plan-schedule.enum';

export interface ChatMessageObject {
  text?: string;
  scheduleId: number;
}

export class ChatMessageScheduleDto {
  amount: number;
  categoryName: string;
  id: number;
  startDate: Date | null;
  status: PlanScheduleStatus;
  title: string;

  static from(entity: PlanScheduleEntity) {
    return plainToInstance(this, {
      amount: entity.amount,
      categoryName: entity.categoryName,
      id: entity.id,
      startDate: entity.startDate,
      status: entity.status,
      title: entity.title,
    });
  }
}

export class ChatMessageDto {
  id: number;
  planUserId: string;
  planUserName: string;
  planUserProfileImageUrl: string;
  text?: string;
  messageType: ChatMessageType;
  schedule?: ChatMessageScheduleDto;
  createDate: Date;
  unreadCount: number;

  static from(
    entity: ChatMessageEntity,
    text?: string,
    schedule?: ChatMessageScheduleDto,
    unreadCount?: number,
  ) {
    return plainToInstance(this, {
      id: entity.id,
      planUserId: entity.planUserId,
      planUserName: entity.planUser.name,
      planUserProfileImageUrl: entity.planUser.getProfileImageUrl(),
      messageType: entity.messageType,
      text,
      schedule,
      createDate: entity.createDate,
      unreadCount: unreadCount ?? 0,
    });
  }
}

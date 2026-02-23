import { DatabaseSort } from '@app/common/enum/global.enum';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlanScheduleRepositoryService } from './plan-schedule.repository.service';
import {
  ChatMessageDto,
  ChatMessageScheduleDto,
} from '../dto/chat-message.dto';
import { ChatMessageEntity } from '../entity/chat-message.entity';
import { ChatRoomMemberEntity } from '../entity/chat-room-member.entity';
import { ChatRoomEntity } from '../entity/chat-room.entity';
import { ChatMessageType } from '../enum/chat-message.enum';

@Injectable()
export class ChatMessageRepositoryService {
  constructor(
    @InjectRepository(ChatMessageEntity)
    private readonly chatMessageRepository: Repository<ChatMessageEntity>,

    @InjectRepository(ChatRoomEntity)
    private readonly chatRoomRepository: Repository<ChatRoomEntity>,

    @InjectRepository(ChatRoomMemberEntity)
    private readonly chatRoomMemberRepository: Repository<ChatRoomMemberEntity>,

    private readonly planScheduleRepositoryService: PlanScheduleRepositoryService,
  ) {}

  async create(entity: ChatMessageEntity): Promise<ChatMessageEntity> {
    return this.chatMessageRepository.save(entity);
  }

  async findByRoomId(
    roomId: number,
    page: number,
    count: number,
    sort: DatabaseSort,
  ): Promise<[ChatMessageDto[], number]> {
    const [messageEntityList, total] =
      await this.chatMessageRepository.findAndCount({
        where: { roomId },
        order: { createDate: sort },
        skip: (page - 1) * count,
        take: count,
        relations: ['planUser'],
      });

    const promises = messageEntityList.map(async (v) => {
      if (v.messageType === ChatMessageType.TEXT) {
        return ChatMessageDto.from(v, v.message.text);
      } else if (v.messageType === ChatMessageType.SCHEDULE) {
        const schedule = await this.planScheduleRepositoryService.findById(
          v.message.scheduleId,
        );

        return ChatMessageDto.from(
          v,
          schedule ? null : '플랜이 삭제 되거나 없습니다.',
          schedule ? ChatMessageScheduleDto.from(schedule) : null,
        );
      }
      return null;
    });

    const results = await Promise.all(promises);

    return [
      results.filter((res): res is ChatMessageDto => res !== null),
      total,
    ];
  }

  async findById(id: number): Promise<ChatMessageDto | null> {
    const chatMessage = await this.chatMessageRepository.findOne({
      where: { id },
    });

    if (chatMessage.messageType === ChatMessageType.TEXT) {
      return ChatMessageDto.from(chatMessage, chatMessage.message.text);
    } else if (chatMessage.messageType === ChatMessageType.SCHEDULE) {
      const schedule = await this.planScheduleRepositoryService.findById(
        chatMessage.message.scheduleId,
      );

      return ChatMessageDto.from(
        chatMessage,
        schedule ? null : '플랜이 삭제 되거나 없습니다.',
        schedule ? ChatMessageScheduleDto.from(schedule) : null,
      );
    }

    return null;
  }

  async createChatRoom(entity: ChatRoomEntity): Promise<ChatRoomEntity> {
    return this.chatRoomRepository.save(entity);
  }

  async getChatRoom(chatRoomId: number): Promise<ChatRoomEntity> {
    const result = await this.chatRoomRepository.findOne({
      where: { id: chatRoomId },
      relations: ['members'],
    });

    if (!result) {
      throw new ServiceError(
        `Chat room not found chatRoomId: ${chatRoomId}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }
    return result;
  }

  async createChatRoomMember(
    entity: ChatRoomMemberEntity,
  ): Promise<ChatRoomMemberEntity> {
    return this.chatRoomMemberRepository.save(entity);
  }

  async findChatRoomByPlanUserId(
    planUserId: string,
  ): Promise<ChatRoomEntity[]> {
    return this.chatRoomRepository.find({
      where: { members: { planUserId } },
    });
  }
}

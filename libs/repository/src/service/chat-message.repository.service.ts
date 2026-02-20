import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlanScheduleRepositoryService } from './plan-schedule.repository.service';
import {
  ChatMessageDto,
  ChatMessageScheduleDto,
} from '../dto/chat-message.dto';
import { ChatMessageEntity } from '../entity/chat-message.entity';
import { ChatMessageType } from '../enum/chat-message.enum';

@Injectable()
export class ChatMessageRepositoryService {
  constructor(
    @InjectRepository(ChatMessageEntity)
    private readonly chatMessageRepository: Repository<ChatMessageEntity>,
    private readonly planScheduleRepositoryService: PlanScheduleRepositoryService,
  ) {}

  async create(entity: ChatMessageEntity): Promise<ChatMessageEntity> {
    return this.chatMessageRepository.save(entity);
  }

  async findByRoomId(
    roomId: number,
    page: number,
    count: number,
  ): Promise<[ChatMessageDto[], number]> {
    const [messageEntityList, total] =
      await this.chatMessageRepository.findAndCount({
        where: { roomId },
        order: { createDate: 'DESC' },
        skip: (page - 1) * count,
        take: count,
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
}

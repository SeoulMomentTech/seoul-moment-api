import { DatabaseSort } from '@app/common/enum/global.enum';
import { ServiceErrorCode } from '@app/common/exception/dto/exception.dto';
import { ServiceError } from '@app/common/exception/service.error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, MoreThan, Not, Repository } from 'typeorm';

import { PlanScheduleRepositoryService } from './plan-schedule.repository.service';
import {
  ChatMessageDto,
  ChatMessageScheduleDto,
} from '../dto/chat-message.dto';
import { UpdateChatRoomDto } from '../dto/chat-room.dto';
import { ChatMessageEntity } from '../entity/chat-message.entity';
import { ChatRoomMemberEntity } from '../entity/chat-room-member.entity';
import { ChatRoomEntity } from '../entity/chat-room.entity';
import { ChatMessageType } from '../enum/chat-message.enum';

@Injectable()
export class ChatRepositoryService {
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

  async findByChatRoomId(
    chatRoomId: number,
    page: number,
    count: number,
    sort: DatabaseSort,
  ): Promise<[ChatMessageDto[], number]> {
    const [messageEntityList, total] =
      await this.chatMessageRepository.findAndCount({
        where: { chatRoomId },
        order: { createDate: sort },
        skip: (page - 1) * count,
        take: count,
        relations: ['planUser'],
      });

    const members = await this.chatRoomMemberRepository.find({
      where: { chatRoomId },
    });

    const promises = messageEntityList.map(async (v) => {
      const unreadCount = members.filter(
        (m) => m.lastReadMessageId < v.id && m.planUserId !== v.planUserId,
      ).length;

      if (v.messageType === ChatMessageType.TEXT) {
        return ChatMessageDto.from(v, v.message.text, null, unreadCount);
      } else if (v.messageType === ChatMessageType.SCHEDULE) {
        const schedule = await this.planScheduleRepositoryService.findById(
          v.message.scheduleId,
        );

        return ChatMessageDto.from(
          v,
          schedule ? null : '플랜이 삭제 되거나 없습니다.',
          schedule ? ChatMessageScheduleDto.from(schedule) : null,
          unreadCount,
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
      relations: ['planUser'],
    });

    const unreadCount = await this.getUnreadCount(
      chatMessage.chatRoomId,
      chatMessage.id,
      chatMessage.planUserId,
    );

    if (chatMessage.messageType === ChatMessageType.TEXT) {
      return ChatMessageDto.from(
        chatMessage,
        chatMessage.message.text,
        null,
        unreadCount,
      );
    } else if (chatMessage.messageType === ChatMessageType.SCHEDULE) {
      const schedule = await this.planScheduleRepositoryService.findById(
        chatMessage.message.scheduleId,
      );

      return ChatMessageDto.from(
        chatMessage,
        schedule ? null : '플랜이 삭제 되거나 없습니다.',
        schedule ? ChatMessageScheduleDto.from(schedule) : null,
        unreadCount,
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

  async getChatRoomByPlanUserRoomId(
    planUserRoomId: number,
  ): Promise<ChatRoomEntity[]> {
    const result = await this.chatRoomRepository.find({
      where: { planUserRoomId },
    });

    if (!result) {
      throw new ServiceError(
        `Chat room not found planUserRoomId: ${planUserRoomId}`,
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
    /*
      where 로 members 를 걸면 TypeORM 이 그 조건에 맞는 멤버만 실어 준다.
      커플 방 판별에는 방의 멤버 전원이 필요하므로, 먼저 내가 속한 방 id 를
      추린 뒤 그 방들을 멤버와 함께 다시 받는다.
    */
    const mine = await this.chatRoomRepository.find({
      where: { members: { planUserId } },
      select: { id: true },
    });

    if (mine.length === 0) return [];

    return this.chatRoomRepository.find({
      where: { id: In(mine.map((v) => v.id)) },
      relations: ['members'],
    });
  }

  /**
   * 방마다 가장 최근 메시지 하나씩. 홈 대시보드의 "대화" 카드가 방 이름
   * 아래에 미리보기로 쓴다.
   *
   * 방 수만큼 쿼리를 돌리지 않도록 DISTINCT ON 으로 한 번에 가져온다.
   * 방이 몇 개 안 되더라도, 목록을 여는 화면마다 N+1 이 생기는 건 피한다.
   */
  async findLastMessageByRoomIds(
    roomIds: number[],
  ): Promise<Map<number, ChatMessageEntity>> {
    if (roomIds.length === 0) return new Map();

    const rows = await this.chatMessageRepository
      .createQueryBuilder('m')
      .distinctOn(['m.chat_room_id'])
      .where('m.chat_room_id IN (:...roomIds)', { roomIds })
      .orderBy('m.chat_room_id', 'ASC')
      .addOrderBy('m.create_date', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .getMany();

    return new Map(rows.map((row) => [row.chatRoomId, row]));
  }

  async updateChatRoom(dto: UpdateChatRoomDto): Promise<ChatRoomEntity> {
    return this.chatRoomRepository.save(dto);
  }

  async getChatRoomById(id: number): Promise<ChatRoomEntity> {
    const result = await this.chatRoomRepository.findOne({
      where: { id },
      relations: ['members', 'members.planUser', 'members.planUser.members'],
    });

    if (!result) {
      throw new ServiceError(
        `Chat room not found id: ${id}`,
        ServiceErrorCode.NOT_FOUND_DATA,
      );
    }
    return result;
  }

  async findLatestChatMessage(
    chatRoomId: number,
  ): Promise<ChatMessageEntity | null> {
    return this.chatMessageRepository.findOne({
      where: { chatRoomId },
      order: { createDate: 'DESC' },
    });
  }

  async updateChatRoomMember(
    chatRoomId: number,
    planUserId: string,
    lastReadMessageId: number,
  ) {
    await this.chatRoomMemberRepository.update(
      {
        chatRoomId,
        planUserId,
      },
      {
        lastReadMessageId,
      },
    );
  }

  async getUnreadCount(
    chatRoomId: number,
    messageId: number,
    senderId: string,
  ): Promise<number> {
    return this.chatRoomMemberRepository.count({
      where: {
        chatRoomId,
        lastReadMessageId: LessThan(messageId),
        planUserId: Not(senderId),
      },
    });
  }

  async getUnreadMessageCount(
    chatRoomId: number,
    planUserId: string,
  ): Promise<number> {
    const member = await this.chatRoomMemberRepository.findOne({
      where: { chatRoomId, planUserId },
    });

    if (!member) {
      return 0;
    }

    return this.chatMessageRepository.count({
      where: {
        chatRoomId,
        id: MoreThan(member.lastReadMessageId),
      },
    });
  }
}

import { DatabaseSort } from '@app/common/enum/global.enum';
import { ChatMessageDto } from '@app/repository/dto/chat-message.dto';
import { UpdateChatRoomDto } from '@app/repository/dto/chat-room.dto';
import { ChatRepositoryService } from '@app/repository/service/chat.repository.service';
import { Injectable } from '@nestjs/common';

import { ChatRoomResponse } from './chat.dto';

@Injectable()
export class ChatService {
  constructor(private readonly chatRepositoryService: ChatRepositoryService) {}

  async getChatMessages(
    chatRoomId: number,
    page: number,
    count: number,
    sort: DatabaseSort,
  ): Promise<[ChatMessageDto[], number]> {
    return this.chatRepositoryService.findByChatRoomId(
      chatRoomId,
      page,
      count,
      sort,
    );
  }

  async patchChatRoomName(chatRoomId: number, name: string): Promise<void> {
    await this.chatRepositoryService.getChatRoomById(chatRoomId);

    const updateDto: UpdateChatRoomDto = {
      id: chatRoomId,
      name,
    };

    await this.chatRepositoryService.updateChatRoom(updateDto);
  }

  async getChatRoomInfo(chatRoomId: number): Promise<ChatRoomResponse> {
    const result = await this.chatRepositoryService.getChatRoomById(chatRoomId);

    return ChatRoomResponse.from(result);
  }

  async getChatRoomMessageCount(
    chatRoomId: number,
    planUserId: string,
  ): Promise<number> {
    const count = await this.chatRepositoryService.getUnreadMessageCount(
      chatRoomId,
      planUserId,
    );

    return count;
  }
}

import { ChatMessageDto } from '@app/repository/dto/chat-message.dto';
import { ChatMessageRepositoryService } from '@app/repository/service/chat-message.repository.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ChatService {
  constructor(
    private readonly chatMessageRepositoryService: ChatMessageRepositoryService,
  ) {}

  async getChatMessages(
    roomId: number,
    page: number,
    count: number,
  ): Promise<[ChatMessageDto[], number]> {
    return this.chatMessageRepositoryService.findByRoomId(roomId, page, count);
  }
}

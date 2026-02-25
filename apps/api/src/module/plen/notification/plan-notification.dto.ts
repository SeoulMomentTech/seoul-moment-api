import { ChatMessageDto } from '@app/repository/dto/chat-message.dto';
import { plainToInstance } from 'class-transformer';

export class PlanNotificationMessageDto {
  roomId: number;
  data: ChatMessageDto;

  static from(roomId: number, data: ChatMessageDto) {
    return plainToInstance(this, {
      roomId,
      data,
    });
  }
}

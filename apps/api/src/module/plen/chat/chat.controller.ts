import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseListDto } from '@app/common/type/response-list';
import { ChatMessageDto } from '@app/repository/dto/chat-message.dto';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PlanApiGuard } from 'apps/api/src/guard/kakao.guard';

import { GetChatMessagesRequest } from './chat.dto';
import { ChatService } from './chat.service';

@Controller('plan/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get(':roomId')
  @ApiOperation({ summary: '채팅 메시지 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseList(ChatMessageDto)
  async getChatMessages(
    @Param('roomId') roomId: number,
    @Query() query: GetChatMessagesRequest,
  ): Promise<ResponseListDto<ChatMessageDto>> {
    const [result, total] = await this.chatService.getChatMessages(
      roomId,
      query.page,
      query.count,
    );
    return new ResponseListDto(result, total);
  }
}

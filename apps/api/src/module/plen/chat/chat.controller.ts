import { ResponseData } from '@app/common/decorator/response-data.decorator';
import { ResponseList } from '@app/common/decorator/response-list.decorator';
import { SwaggerAuthName } from '@app/common/docs/swagger.dto';
import { ResponseDataDto } from '@app/common/type/response-data';
import { ResponseListDto } from '@app/common/type/response-list';
import { ChatMessageDto } from '@app/repository/dto/chat-message.dto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PlanApiGuard } from 'apps/api/src/guard/kakao.guard';

import {
  ChatRoomResponse,
  GetChatMessagesRequest,
  PatchChatRoomNameRequest,
} from './chat.dto';
import { ChatService } from './chat.service';

@Controller('plan/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get(':chatRoomId([0-9]+)')
  @ApiOperation({ summary: '채팅 메시지 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseList(ChatMessageDto)
  async getChatMessages(
    @Param('chatRoomId') chatRoomId: number,
    @Query() query: GetChatMessagesRequest,
  ): Promise<ResponseListDto<ChatMessageDto>> {
    const [result, total] = await this.chatService.getChatMessages(
      chatRoomId,
      query.page,
      query.count,
      query.sort,
    );
    return new ResponseListDto(result, total);
  }

  @Get('info/:chatRoomId([0-9]+)')
  @ApiOperation({ summary: '채팅방 정보 조회' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @ResponseData(ChatRoomResponse)
  async getChatRoomInfo(
    @Param('chatRoomId') chatRoomId: number,
  ): Promise<ResponseDataDto<ChatRoomResponse>> {
    const result = await this.chatService.getChatRoomInfo(chatRoomId);

    return new ResponseDataDto(result);
  }

  @Patch('name/:chatRoomId([0-9]+)')
  @ApiOperation({ summary: '채팅방 이름 수정' })
  @ApiBearerAuth(SwaggerAuthName.ACCESS_TOKEN)
  @UseGuards(PlanApiGuard)
  @HttpCode(HttpStatus.OK)
  async patchChatRoomName(
    @Param('chatRoomId') chatRoomId: number,
    @Body() body: PatchChatRoomNameRequest,
  ): Promise<void> {
    await this.chatService.patchChatRoomName(chatRoomId, body.name);
  }
}

/* eslint-disable max-lines-per-function */
import { LoggerService } from '@app/common/log/logger.service';
import { ChatMessageEntity } from '@app/repository/entity/chat-message.entity';
import { ChatMessageType } from '@app/repository/enum/chat-message.enum';
import { ChatRepositoryService } from '@app/repository/service/chat.repository.service';
import { PlanUserRoomRepositoryService } from '@app/repository/service/plan-user-room.repository.service';
import { PlanUserRepositoryService } from '@app/repository/service/plan-user.repository.service';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { PlanNotificationMessageDto } from 'apps/api/src/module/plen/notification/plan-notification.dto';
import { PlanNotificationService } from 'apps/api/src/module/plen/notification/plan-notification.service';
import { plainToInstance } from 'class-transformer';
import { Server, Socket } from 'socket.io';

// DB 대용으로 사용할 메모리 객체
// 구조: { "방이름": { users: ["socketId1", "socketId2"], createdAt: Date } }
const roomsData: Record<string, { users: string[]; createdAt: Date }> = {};

@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: ['http://localhost:3000', 'https://wedding-plant.vercel.app'],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly logger: LoggerService,
    private readonly planUserRoomRepositoryService: PlanUserRoomRepositoryService,
    private readonly planUserRepositoryService: PlanUserRepositoryService,
    private readonly chatMessageRepositoryService: ChatRepositoryService,
    private readonly planNotificationService: PlanNotificationService,
  ) {}

  @WebSocketServer() server: Server;
  handleConnection() {
    this.emitRoomList();
  }

  async handleDisconnect(client: Socket) {
    const planUser = (client as any).planUser;
    const chatRoomId = (client as any).chatRoomId;

    this.logger.info(
      `[DISCONNECT] Socket: ${client.id} | User: ${planUser?.id || 'unknown'} | Room: ${chatRoomId || 'unknown'}`,
    );

    // 유저가 예기치 않게 나갔을 때 모든 방에서 해당 유저 제거
    if (planUser) {
      this.removeUserFromAllRooms(planUser.id);
    }
    this.emitRoomList();

    // 마지막 읽은 메시지 업데이트
    if (planUser && chatRoomId) {
      await this.updateChatRoomMember(chatRoomId, planUser.id);
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { room: number; userId: string },
  ) {
    const { room, userId } = payload;

    try {
      // 1. DB 또는 서비스에서 방 존재 여부 확인
      // 여기서 404 에러가 발생하면 catch 블록으로 넘어갑니다.
      const chatRoom =
        await this.chatMessageRepositoryService.getChatRoom(room);

      await this.planUserRoomRepositoryService.getByRoomId(
        chatRoom.planUserRoomId,
      );
      const planUser = await this.planUserRepositoryService.getById(userId);

      // 3. 소켓 객체에 데이터 바인딩
      (client as any).planUser = planUser;
      (client as any).chatRoomId = room;

      // 4. 메모리 데이터 업데이트 (roomsData)
      if (!roomsData[room]) {
        roomsData[room] = { users: [userId], createdAt: new Date() };
      } else {
        if (!roomsData[room].users.includes(userId)) {
          roomsData[room].users.push(userId);
        }
      }

      await this.updateChatRoomMember(room, userId);

      this.logger.info(
        `============== roomsData ============== ${JSON.stringify(roomsData)}`,
      );

      // 5. 실제 소켓 룸 입장
      await client.join(room.toString());
      this.emitRoomList();
    } catch (error) {
      // 404 에러나 다른 예외가 발생했을 때 클라이언트에게 알림
      console.error(`방 입장 실패 (Room: ${room}):`, error.message);

      client.emit('error', '존재하지 않는 방이거나 입장에 실패했습니다.');

      // 필요하다면 특정 방에서 유저를 정리하는 로직 추가
    }
  }

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      room: number;
      message: string;
      messageType: ChatMessageType;
      planUser?: { id: string; name: string; profileImageUrl: string };
    },
  ) {
    const { room, message, messageType, planUser } = payload;

    try {
      const chatRoom =
        await this.chatMessageRepositoryService.getChatRoom(room);

      await this.planUserRoomRepositoryService.getByRoomId(
        chatRoom.planUserRoomId,
      );

      const senderPlanUser = planUser || (client as any).planUser;

      this.logger.info(
        `[MSG] Room: ${room} | User: ${senderPlanUser.id} | Text: ${message}`,
      );

      const chatMessage = await this.chatMessageRepositoryService.create(
        plainToInstance(ChatMessageEntity, {
          chatRoomId: room,
          planUserId: senderPlanUser.id,
          message:
            messageType === ChatMessageType.TEXT
              ? { text: message }
              : { scheduleId: Number(message) },
          messageType,
        }),
      );

      if (roomsData[room]?.users?.length) {
        if (roomsData[room].users.length === chatRoom.members.length) {
          await Promise.all(
            chatRoom.members.map(
              async (v) => await this.updateChatRoomMember(room, v.planUserId),
            ),
          );
        }
      }

      if (planUser) {
        await Promise.all(
          chatRoom.members
            .filter((v) => v.planUserId === planUser.id)
            .map(
              async (v) => await this.updateChatRoomMember(room, v.planUserId),
            ),
        );
      }

      const chatMessageDto = await this.chatMessageRepositoryService.findById(
        chatMessage.id,
      );

      this.planNotificationService.emitMessage(
        PlanNotificationMessageDto.from(room, chatMessageDto),
      );

      // 소켓 서버에서 room.toString() 채널로 메시지 전송
      this.server.to(room.toString()).emit('message', {
        senderId: senderPlanUser.id,
        senderName: senderPlanUser.name,
        senderProfileImageUrl: senderPlanUser.profileImageUrl,
        message: chatMessageDto,
        timestamp: new Date().toISOString(),
        unreadCount: chatMessageDto?.unreadCount ?? 0,
      });
    } catch (error) {
      this.logger.error(`메시지 전송 실패 (Room: ${room}):`, error.message);
      client.emit(
        'error',
        '존재하지 않는 방이거나 메시지 전송에 실패했습니다.',
      );
    }
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() room: string,
  ) {
    const planUser = (client as any).planUser;

    if (planUser) {
      this.removeUserFromRoom(planUser.id, room);
      this.logger.info(`[LEAVE] Socket: ${client.id} | User: ${planUser.id}`);
      await this.updateChatRoomMember(Number(room), planUser.id);
    } else {
      this.logger.warn(`[LEAVE] Socket: ${client.id} | User: unknown`);
      client.emit('error', '존재하지 않는 유저이거나 방 퇴장에 실패했습니다.');
    }

    await client.leave(room);
    this.emitRoomList();
  }

  // 특정 방에서 유저 제거 및 방 삭제 로직
  private removeUserFromRoom(userId: string, room: string) {
    if (roomsData[room]) {
      roomsData[room].users = roomsData[room].users.filter(
        (id) => id !== userId,
      );

      // 방에 아무도 없으면 방 삭제
      if (roomsData[room].users.length === 0) {
        delete roomsData[room];
        this.logger.info(`방 삭제됨 (인원 0명): ${room}`);
      }
    }
  }

  // 모든 방을 돌며 유저 제거 (연결 해제 시 사용)
  private removeUserFromAllRooms(userId: string) {
    Object.keys(roomsData).forEach((room) => {
      this.removeUserFromRoom(userId, room);
    });
  }

  private emitRoomList() {
    // roomsData 객체를 배열로 변환하여 전송
    const list = Object.keys(roomsData).map((name) => ({
      name,
      count: roomsData[name].users.length,
    }));
    this.server.emit('roomList', list);
  }

  private async updateChatRoomMember(chatRoomId: number, planUserId: string) {
    const latestChatMessage =
      await this.chatMessageRepositoryService.findLatestChatMessage(chatRoomId);

    await this.chatMessageRepositoryService.updateChatRoomMember(
      chatRoomId,
      planUserId,
      latestChatMessage?.id || 0,
    );
  }
}

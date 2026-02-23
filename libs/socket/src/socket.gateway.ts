/* eslint-disable max-lines-per-function */
import { LoggerService } from '@app/common/log/logger.service';
import { ChatMessageEntity } from '@app/repository/entity/chat-message.entity';
import { ChatMessageType } from '@app/repository/enum/chat-message.enum';
import { ChatMessageRepositoryService } from '@app/repository/service/chat-message.repository.service';
import { PlanScheduleRepositoryService } from '@app/repository/service/plan-schedule.repository.service';
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
import { plainToInstance } from 'class-transformer';
import { Server, Socket } from 'socket.io';

// DB 대용으로 사용할 메모리 객체
// 구조: { "방이름": { users: ["socketId1", "socketId2"], createdAt: Date } }
const roomsData: Record<string, { users: string[]; createdAt: Date }> = {};

@WebSocketGateway({ namespace: 'chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly logger: LoggerService,
    private readonly planUserRoomRepositoryService: PlanUserRoomRepositoryService,
    private readonly planUserRepositoryService: PlanUserRepositoryService,
    private readonly chatMessageRepositoryService: ChatMessageRepositoryService,
    private readonly planScheduleRepositoryService: PlanScheduleRepositoryService,
  ) {}

  @WebSocketServer() server: Server;

  handleConnection() {
    this.emitRoomList();
  }

  handleDisconnect(client: Socket) {
    // 유저가 예기치 않게 나갔을 때 모든 방에서 해당 유저 제거
    this.removeUserFromAllRooms(client.id);
    this.emitRoomList();
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
      await this.planUserRoomRepositoryService.getByRoomId(room);
      const planUser = await this.planUserRepositoryService.getById(userId);

      // 3. 소켓 객체에 데이터 바인딩
      (client as any).planUser = planUser;

      // 4. 메모리 데이터 업데이트 (roomsData)
      if (!roomsData[room]) {
        roomsData[room] = { users: [userId], createdAt: new Date() };
      } else {
        if (!roomsData[room].users.includes(userId)) {
          roomsData[room].users.push(userId);
        }
      }

      this.logger.info('============== roomsData ==============\n', {
        roomsData,
      });

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
    payload: { room: number; message: string; messageType: ChatMessageType },
  ) {
    const { room, message, messageType } = payload;

    try {
      const chatRoom =
        await this.chatMessageRepositoryService.getChatRoom(room);

      await this.planUserRoomRepositoryService.getByRoomId(
        chatRoom.planUserRoomId,
      );

      const senderPlanUser = (client as any).planUser;

      this.logger.info(
        `[MSG] Room: ${room} | User: ${senderPlanUser.id} | Text: ${message}`,
      );

      const chatMessage = await this.chatMessageRepositoryService.create(
        plainToInstance(ChatMessageEntity, {
          roomId: room,
          planUserId: senderPlanUser.id,
          message:
            messageType === ChatMessageType.TEXT
              ? { text: message }
              : { scheduleId: Number(message) },
          messageType,
        }),
      );

      const chatMessageDto = await this.chatMessageRepositoryService.findById(
        chatMessage.id,
      );

      // 소켓 서버에서 room.toString() 채널로 메시지 전송
      this.server.to(room.toString()).emit('message', {
        senderId: senderPlanUser.id,
        senderName: senderPlanUser.name,
        senderProfileImageUrl: senderPlanUser.profileImageUrl,
        message: chatMessageDto,
        timestamp: new Date().toISOString(),
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
    this.removeUserFromRoom(client.id, room);
    await client.leave(room);
    this.emitRoomList();
  }

  // 특정 방에서 유저 제거 및 방 삭제 로직
  private removeUserFromRoom(socketId: string, room: string) {
    if (roomsData[room]) {
      roomsData[room].users = roomsData[room].users.filter(
        (id) => id !== socketId,
      );

      // 방에 아무도 없으면 방 삭제
      if (roomsData[room].users.length === 0) {
        delete roomsData[room];
        this.logger.info(`방 삭제됨 (인원 0명): ${room}`);
      }
    }
  }

  // 모든 방을 돌며 유저 제거 (연결 해제 시 사용)
  private removeUserFromAllRooms(socketId: string) {
    Object.keys(roomsData).forEach((room) => {
      this.removeUserFromRoom(socketId, room);
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
}

/* eslint-disable max-lines-per-function */
import { LoggerService } from '@app/common/log/logger.service';
import { ChatMessageEntity } from '@app/repository/entity/chat-message.entity';
import { ChatRoomEntity } from '@app/repository/entity/chat-room.entity';
import { ChatMessageType } from '@app/repository/enum/chat-message.enum';
import { ChatRepositoryService } from '@app/repository/service/chat.repository.service';
import { PlanUserRoomRepositoryService } from '@app/repository/service/plan-user-room.repository.service';
import { PlanUserRepositoryService } from '@app/repository/service/plan-user.repository.service';
import { JwtService } from '@nestjs/jwt';
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
    private readonly jwtService: JwtService,
  ) {}

  @WebSocketServer() server: Server;

  /**
   * 소켓에 인증을 건다. 예전에는 아무 검증이 없어서 방 id 와 아무 사용자
   * id 만 알면 남의 이름으로 메시지를 넣을 수 있었다.
   *
   * 웹·안드로이드·iOS 모두 이미 `auth: { token }` 을 보내고 있어 클라이언트
   * 변경 없이 켤 수 있다. 카카오 토큰 재검증(PlanApiGuard 가 하는 일)까지
   * 매 연결마다 하지는 않는다 — JWT 는 우리가 서명한 것이고, 소켓 연결마다
   * 외부 API 를 때리면 채팅 진입이 느려진다.
   */
  async handleConnection(client: Socket) {
    try {
      const token = (client.handshake?.auth as { token?: string })?.token;

      if (!token) throw new Error('no token');

      const payload = this.jwtService.verify(token);
      const planUser = await this.planUserRepositoryService.getById(
        payload.planUserId ?? payload.sub,
      );

      (client as any).planUser = planUser;
    } catch (error) {
      this.logger.info(`[SOCKET] 인증 실패로 연결을 끊는다: ${error.message}`);
      client.emit('error', '로그인이 필요합니다.');
      client.disconnect(true);
      return;
    }

    this.emitRoomList();
  }

  /** 이 소켓의 사용자가 그 채팅방 멤버인지 */
  private assertChatRoomMember(chatRoom: ChatRoomEntity, planUserId: string) {
    const isMember = (chatRoom.members ?? []).some(
      (m) => m.planUserId === planUserId,
    );

    if (!isMember) {
      throw new Error(`not a member of chat room ${chatRoom.id}`);
    }
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
    const { room } = payload;

    try {
      // 1. DB 또는 서비스에서 방 존재 여부 확인
      // 여기서 404 에러가 발생하면 catch 블록으로 넘어갑니다.
      const chatRoom =
        await this.chatMessageRepositoryService.getChatRoom(room);

      await this.planUserRoomRepositoryService.getByRoomId(
        chatRoom.planUserRoomId,
      );

      /*
        payload 의 userId 는 쓰지 않는다. 예전에는 그 값을 그대로 믿어서
        아무 id 나 적어 남의 이름으로 들어갈 수 있었다. 연결할 때 토큰으로
        확인한 사용자만 쓰고, 그 방 멤버인지도 본다.
      */
      const planUser = (client as any).planUser;
      if (!planUser) throw new Error('unauthenticated socket');

      this.assertChatRoomMember(chatRoom, planUser.id);

      const userId = planUser.id;

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

      /*
        payload 의 planUser 도 믿지 않는다. 연결 때 확인한 사용자만 쓴다.
        조언자도 대화는 할 수 있으므로 권한은 보지 않고 멤버인지만 본다.
      */
      const senderPlanUser = (client as any).planUser;
      if (!senderPlanUser) throw new Error('unauthenticated socket');

      this.assertChatRoomMember(chatRoom, senderPlanUser.id);

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

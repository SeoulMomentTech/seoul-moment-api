import { LoggerService } from '@app/common/log/logger.service';
import { FcmService } from '@app/external/firebase/fcm.service';
import { ChatMessageDto } from '@app/repository/dto/chat-message.dto';
import { ChatRepositoryService } from '@app/repository/service/chat.repository.service';
import { PlanUserDeviceTokenRepositoryService } from '@app/repository/service/plan-user-device-token.repository.service';
import { Injectable } from '@nestjs/common';

import { buildChatPushData } from './plan-push.dto';

@Injectable()
export class PlanPushService {
  constructor(
    private readonly chatRepositoryService: ChatRepositoryService,
    private readonly planUserDeviceTokenRepositoryService: PlanUserDeviceTokenRepositoryService,
    private readonly fcmService: FcmService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * 채팅 메시지를 앱이 꺼져 있는 참여자의 기기로 보낸다.
   *
   * 보낸 사람은 반드시 제외한다 — 앱의 FCM 경로에는 SSE 와 달리 발신자 필터가 없어서
   * 여기서 걸러내지 않으면 자기가 보낸 메시지 알림이 자기 기기에 뜬다.
   *
   * 절대 throw 하지 않는다. 푸시는 부가 기능이고, 실패가 채팅 전송을 깨뜨리면 안 된다.
   */
  async sendChatMessage(
    chatRoomId: number,
    message: ChatMessageDto,
  ): Promise<void> {
    if (!this.fcmService.isConfigured()) {
      return;
    }

    try {
      const tokens = await this.getReceiverTokens(chatRoomId, message);

      if (tokens.length === 0) {
        return;
      }

      const result = await this.fcmService.sendDataMessage(
        tokens,
        buildChatPushData(chatRoomId, message),
      );

      if (result.hasInvalidTokens()) {
        await this.planUserDeviceTokenRepositoryService.deleteByTokens(
          result.invalidTokens,
        );
      }

      this.logger.info(
        `[FCM] room: ${chatRoomId} | sent: ${result.successCount} | failed: ${result.failureCount} | removed: ${result.invalidTokens.length}`,
      );
    } catch (error) {
      this.logger.error(
        `[FCM] chat push failed (room: ${chatRoomId}): ${error.message}`,
      );
    }
  }

  private async getReceiverTokens(
    chatRoomId: number,
    message: ChatMessageDto,
  ): Promise<string[]> {
    const chatRoom = await this.chatRepositoryService.getChatRoom(chatRoomId);

    const receiverIds = chatRoom.members
      .map((member) => member.planUserId)
      .filter((planUserId) => planUserId !== message.planUserId);

    return this.planUserDeviceTokenRepositoryService.findTokensByPlanUserIds(
      receiverIds,
    );
  }
}

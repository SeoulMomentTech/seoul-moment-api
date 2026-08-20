import {
  ChatMessageDto,
  ChatMessageScheduleDto,
} from '@app/repository/dto/chat-message.dto';
import { ChatMessageType } from '@app/repository/enum/chat-message.enum';

/** 앱(WeddingPlantMessagingService)이 읽는 키. 값은 FCM 규칙상 전부 문자열이어야 한다. */
export interface ChatPushData extends Record<string, string> {
  chatRoomId: string;
  senderName: string;
  body: string;
}

const DEFAULT_SENDER_NAME = '새 메시지';
const SHARE_PREFIX = '플랜을 공유했어요!';

/**
 * SSE 페이로드가 JSON 으로 직렬화됐을 때의 앞 10글자(YYYY-MM-DD)를 그대로 재현한다.
 * 앱은 SSE 에서 `startDate.take(10)` 을 쓰므로 같은 값을 만들어야 두 경로의 문구가 갈리지 않는다.
 */
const toDisplayDate = (startDate: Date | string | null): string => {
  if (!startDate) {
    return '';
  }

  return startDate instanceof Date
    ? startDate.toISOString().slice(0, 10)
    : String(startDate).slice(0, 10);
};

/** 플랜 공유 메시지 요약. 앱의 SSE 경로(NotificationManager.buildMessage)와 같은 형식이다. */
const buildScheduleBody = (schedule?: ChatMessageScheduleDto): string => {
  if (!schedule) {
    return SHARE_PREFIX;
  }

  const amount =
    schedule.amount > 0 ? ` - ${Math.trunc(schedule.amount)}만원` : '';
  const date = toDisplayDate(schedule.startDate);

  return `${SHARE_PREFIX} [${schedule.categoryName ?? ''}] ${schedule.title ?? ''}${amount}${date ? ` (${date})` : ''}`;
};

export const buildChatPushData = (
  chatRoomId: number,
  message: ChatMessageDto,
): ChatPushData => ({
  chatRoomId: String(chatRoomId),
  senderName: message.planUserName || DEFAULT_SENDER_NAME,
  body:
    message.messageType === ChatMessageType.SCHEDULE
      ? buildScheduleBody(message.schedule)
      : message.text || '메시지가 도착했습니다.',
});

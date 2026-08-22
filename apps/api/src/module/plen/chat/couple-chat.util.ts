import { ChatRoomEntity } from '@app/repository/entity/chat-room.entity';

/**
 * 신랑·신부 방인지. 별도 컬럼을 두지 않고 멤버 구성으로 판별한다 —
 * 방장과 배우자 둘만 있는 채팅방이 커플 방이다. 배우자를 바꿔도 저절로
 * 따라오고, 플래그가 실제 멤버와 어긋날 일이 없다.
 *
 * @param coupleIds 그 플랜 방의 [방장, 배우자] id. 배우자가 없으면 undefined
 */
export function isCoupleChatRoom(
  entity: ChatRoomEntity,
  coupleIds?: string[],
): boolean {
  if (!coupleIds || coupleIds.length !== 2) return false;

  const memberIds = (entity.members ?? []).map((m) => m.planUserId);
  if (memberIds.length !== 2) return false;

  return coupleIds.every((id) => memberIds.includes(id));
}

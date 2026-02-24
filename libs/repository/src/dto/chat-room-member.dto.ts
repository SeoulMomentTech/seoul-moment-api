import { RequireKey } from '@app/common/type/require-key.type';

import { ChatRoomMemberEntity } from '../entity/chat-room-member.entity';

export type UpdateChatRoomMemberDto = RequireKey<ChatRoomMemberEntity, 'id'>;

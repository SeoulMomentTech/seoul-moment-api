import { RequireKey } from '@app/common/type/require-key.type';

import { ChatRoomEntity } from '../entity/chat-room.entity';

export type UpdateChatRoomDto = RequireKey<ChatRoomEntity, 'id'>;

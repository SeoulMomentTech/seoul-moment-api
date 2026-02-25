import { ChatRoomEntity } from '@app/repository/entity/chat-room.entity';
import { PlanUserEntity } from '@app/repository/entity/plan-user.entity';
import { PlanUserRoomMemberPermission } from '@app/repository/enum/plan-user-room-member.enum';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { IsDefined, IsString } from 'class-validator';

import { ListFilterDto } from '../../admin/admin.dto';

export class GetChatMessagesRequest extends ListFilterDto {}

export class GetChatRoomMemberResponse {
  @ApiProperty({
    description: '플랜 유저 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  planUserId: string;

  @ApiProperty({
    description: '플랜 유저 이름/닉네임',
    example: '세리프',
  })
  name: string;

  @ApiProperty({
    description: '플랜 유저 이미지',
  })
  image: string;

  @ApiProperty({
    description: '플랜 유저 권한',
    example: 'READ',
  })
  permission: PlanUserRoomMemberPermission;

  static from(entity: PlanUserEntity) {
    return plainToInstance(this, {
      planUserId: entity.id,
      name: entity.name,
      image: entity.getProfileImageUrl(),
      permission: entity.members.find(
        (member) => member.planUserId === entity.id,
      )?.permission,
    });
  }
}

export class ChatRoomResponse {
  @ApiProperty({
    description: '채팅방 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '채팅방 이름',
    example: '채팅방 이름',
  })
  name: string;

  memberList: GetChatRoomMemberResponse[];

  static from(entity: ChatRoomEntity) {
    return plainToInstance(this, {
      id: entity.id,
      name: entity.name ?? '채팅방',
      memberList: entity.members.map((member) =>
        GetChatRoomMemberResponse.from(member.planUser),
      ),
    });
  }
}

export class PatchChatRoomNameRequest {
  @ApiProperty({
    description: '채팅방 이름',
    example: '채팅방 이름',
  })
  @IsString()
  @IsDefined()
  name: string;
}

export class GetChatRoomMessageCountResponse {
  @ApiProperty({
    description: '채팅방 메시지 개수',
    example: 1,
  })
  count: number;

  static from(count: number) {
    return plainToInstance(this, {
      count,
    });
  }
}

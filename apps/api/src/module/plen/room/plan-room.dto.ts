import { PlanUserRoomEntity } from '@app/repository/entity/plan-user-room.entity';
import { PlanUserEntity } from '@app/repository/entity/plan-user.entity';
import { PlanScheduleStatus } from '@app/repository/enum/plan-schedule.enum';
import { PlanUserRoomMemberPermission } from '@app/repository/enum/plan-user-room-member.enum';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

import { ChatRoomResponse } from '../chat/chat.dto';
import { GetPlanUserRoomMemberResponse } from '../user/plan-user.dto';

export class GetPlanRoomMemberResponse {
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

// GET /plan/room/:roomId
export class GetPlanRoomResponse {
  @ApiProperty({
    description: '웨딩 날짜',
    example: '2025-02-24',
  })
  weddingDate: string;

  @ApiProperty({
    description: '예산 (만원 단위)',
    example: 10000,
  })
  budget: number;

  @ApiProperty({
    description: '이름/닉네임',
    example: '세리프',
  })
  name: string;

  @ApiProperty({
    description: '플랜 유저 방 멤버 목록',
    example: [
      {
        planUserId: '123e4567-e89b-12d3-a456-426614174000',
        name: '세리프',
        image: 'https://example.com/image.png',
        permission: 'WRITE',
      },
      {
        planUserId: '123e4567-e89b-12d3-a456-426614174000',
        name: '세리프',
        image: 'https://example.com/image.png',
        permission: 'OWNER',
      },
    ],
  })
  members: GetPlanRoomMemberResponse[];

  static from(
    entity: PlanUserEntity,
    members: GetPlanRoomMemberResponse[] = [],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      weddingDate: entity.weddingDate,
      budget: entity.budget,
      name: entity.name,
      members,
    });
  }
}

// GET /plan/room/share-code
export class GetRoomShareCodeResponse {
  @ApiProperty({
    description: '방 공유 코드',
    example: '1234567890',
  })
  shareCode: string;

  static from(entity: PlanUserEntity) {
    return plainToInstance(this, {
      shareCode: entity.roomShareCode,
    });
  }
}

export class GetPlanRoomListResponse {
  @ApiProperty({
    description: '방 ID',
    example: 1,
  })
  roomId: number;

  @ApiProperty({
    description: '주인 이름',
    example: '홍길동',
  })
  onwerName: string;

  @ApiProperty({
    description: '웨딩 날짜',
    example: '2025-02-24',
  })
  weddingDate: string;

  @ApiProperty({
    description: '예산 (만원 단위)',
    example: 10000,
  })
  budget: number;

  @ApiProperty({
    description: '남은 금액 (만원 단위)',
    example: 10000,
  })
  remainingBudget: number;

  @ApiProperty({
    description: '계획 개수',
    example: 10,
  })
  planCount: number;

  @ApiProperty({
    description: '채팅방 목록',
    example: [
      {
        id: 1,
        name: '채팅방 이름',
      },
    ],
  })
  chatRooms: ChatRoomResponse[];

  static from(
    entity: PlanUserRoomEntity,
    remainingBudget: number,
    memberDtoList: GetPlanUserRoomMemberResponse[],
  ) {
    return plainToInstance(this, {
      roomId: entity.id,
      onwerName: entity.owner.name,
      weddingDate: entity.owner.weddingDate,
      budget: entity.owner.budget,
      remainingBudget,
      planCount: entity.schedules.filter(
        (v) => v.status !== PlanScheduleStatus.DELETE,
      ).length,
      members: memberDtoList,
      chatRooms: entity.chatRooms.map((chatRoom) =>
        ChatRoomResponse.from(chatRoom),
      ),
    });
  }
}

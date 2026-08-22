import { ChatMessageEntity } from '@app/repository/entity/chat-message.entity';
import { ChatRoomEntity } from '@app/repository/entity/chat-room.entity';
import { PlanUserEntity } from '@app/repository/entity/plan-user.entity';
import { DevicePlatform } from '@app/repository/enum/plan-user-device-token.enum';
import { PlanUserRoomMemberPermission } from '@app/repository/enum/plan-user-room-member.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { isCoupleChatRoom } from '../chat/couple-chat.util';

export class GetUserChatRoomResponse {
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

  @ApiPropertyOptional({
    description:
      '마지막 메시지 미리보기. 홈 대시보드의 "대화" 카드가 방 이름 아래에 쓴다. 사진·플랜 공유는 텍스트가 없어 null 이다',
    example: '드레스 투어 23일 일요일 11시로 잡았어',
  })
  lastMessage: string | null;

  @ApiPropertyOptional({
    description: '마지막 메시지 시각 (ISO). 메시지가 없으면 null',
    example: '2026-08-21T02:14:00.000Z',
  })
  lastMessageDate: string | null;

  @ApiProperty({
    description:
      '신랑·신부 방인지. 방장과 배우자 둘만 있는 방이다. 목록에서 맨 위에 두고 다르게 보여준다',
    example: true,
  })
  isCouple: boolean;

  static from(
    entity: ChatRoomEntity,
    lastMessage?: ChatMessageEntity | null,
    coupleIds?: string[],
  ) {
    // 플랜 공유 메시지는 message.text 가 비어 있다. 그때는 문구를 지어내지
    // 않고 null 을 준다 — 프론트가 미리보기 줄을 아예 그리지 않는다.
    const text = lastMessage?.message?.text?.trim();
    return plainToInstance(GetUserChatRoomResponse, {
      id: entity.id,
      name: entity.name ?? '채팅방',
      lastMessage: text || null,
      lastMessageDate: lastMessage?.createDate ?? null,
      isCouple: isCoupleChatRoom(entity, coupleIds),
    });
  }
}

export class GetPlanUserResponse {
  @ApiProperty({
    description: 'UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: '방 ID',
    example: 1,
  })
  roomId: number;

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

  @ApiPropertyOptional({
    description: '예식장 이름',
    example: '그랜드하얏트 서울',
  })
  weddingVenue: string | null;

  @ApiProperty({
    description: '플랜 유저 방 멤버 목록',
    example: [
      {
        planUserId: '123e4567-e89b-12d3-a456-426614174000',
        name: '세리프',
        image: 'https://example.com/image.png',
        permission: 'READ',
      },
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
  members: GetPlanUserRoomMemberResponse[];

  @ApiProperty({
    description: '채팅방 목록',
    example: [
      {
        id: 1,
        name: '채팅방 이름',
      },
    ],
  })
  chatRooms: GetUserChatRoomResponse[];

  @ApiProperty({
    description: '메인 가이드 조회 여부',
    example: true,
  })
  hasSeenMainGuide: boolean;

  @ApiProperty({
    description: '예산 가이드 조회 여부',
    example: true,
  })
  hasSeenBudgetGuide: boolean;

  @ApiProperty({
    description: '채팅 가이드 조회 여부',
    example: true,
  })
  hasSeenChatGuide: boolean;

  static from(
    entity: PlanUserEntity,
    members: GetPlanUserRoomMemberResponse[] = [],
    chatRooms: GetUserChatRoomResponse[] = [],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      roomId: entity?.room?.id,
      weddingDate: entity.weddingDate,
      budget: entity.budget,
      name: entity.name,
      weddingVenue: entity.weddingVenue ?? null,
      members,
      hasSeenMainGuide: entity.hasSeenMainGuideDate !== null,
      hasSeenBudgetGuide: entity.hasSeenBudgetGuideDate !== null,
      hasSeenChatGuide: entity.hasSeenChatGuideDate !== null,
      chatRooms,
    });
  }
}

export class PatchPlanUserRequest {
  @ApiProperty({
    description: '웨딩 날짜',
    example: '2025-02-24',
  })
  @IsString()
  @IsDefined()
  weddingDate: string;

  @ApiProperty({
    description: '예산 (만원 단위)',
    example: 10000,
  })
  @IsNumber()
  @IsDefined()
  @Type(() => Number)
  budget: number;

  @ApiProperty({
    description: '이름/닉네임',
    example: '세리프',
  })
  @IsString()
  @IsDefined()
  name: string;

  @ApiProperty({
    description: '필수 동의 여부',
    example: '2025-02-24',
  })
  @IsString()
  @IsDefined()
  requiredAgreementDate: string;

  @ApiProperty({
    description: '광고 동의 여부',
    example: '2025-02-24',
  })
  @IsString()
  @IsDefined()
  adAgreementDate: string;
}

export class PatchPlanUserResponse {
  @ApiProperty({
    description: 'UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

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

  static from(entity: PlanUserEntity) {
    return plainToInstance(this, {
      id: entity.id,
      weddingDate: entity.weddingDate,
      budget: entity.budget,
      name: entity.name,
    });
  }
}

export class GetPlanUserAmountCategory {
  @ApiProperty({
    description: '카테고리 이름',
    example: '저녁 식사',
  })
  categoryName: string;

  @ApiProperty({
    description: '카테고리별 예정 금액 합계',
    example: 10000,
  })
  totalAmount: number;

  @ApiProperty({
    description: '카테고리별 사용 금액 합계',
    example: 5000,
  })
  usedAmount: number;

  static from(categoryName: string, totalAmount: number, usedAmount: number) {
    return plainToInstance(this, {
      categoryName,
      totalAmount,
      usedAmount,
    });
  }
}

export class GetPlanUserAmountResponse {
  @ApiProperty({
    description: '초기 자본',
    example: 10000,
  })
  initialCapital: number;

  @ApiProperty({
    description: '사용할 금액 + 사용한 금액 합계',
    example: 10000,
  })
  totalPlannedAndUsedAmount: number;

  @ApiProperty({
    description: '사용 예정 금액 (사용할 금액만)',
    example: 10000,
  })
  plannedUseAmount: number;

  @ApiProperty({
    description: '사용한 금액',
    example: 10000,
  })
  usedAmount: number;

  static from(
    initialCapital: number,
    plannedUseAmount: number,
    usedAmount: number,
  ) {
    return plainToInstance(this, {
      initialCapital,
      totalPlannedAndUsedAmount: plannedUseAmount + usedAmount,
      plannedUseAmount,
      usedAmount,
    });
  }
}

export class GetPlanUserAmountCategoryRequest {
  @ApiPropertyOptional({
    description: '카테고리 이름',
    example: '저녁 식사',
  })
  @IsOptional()
  @IsString()
  categoryName: string;
}

export class GetPlanUserRoomMemberResponse {
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

export class PostPlanUserDeviceTokenRequest {
  @ApiProperty({
    description: 'FCM 등록 토큰. 재설치·데이터 삭제·장기 미사용으로 바뀐다',
    example: 'fMEP0vJqS0m...:APA91bH...',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;

  @ApiProperty({
    description: '기기 플랫폼',
    enum: DevicePlatform,
    example: DevicePlatform.ANDROID,
  })
  @IsDefined()
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;
}

export class DeletePlanUserDeviceTokenRequest {
  @ApiProperty({
    description: '해제할 FCM 등록 토큰. 그 기기 하나만 발송 대상에서 빠진다',
    example: 'fMEP0vJqS0m...:APA91bH...',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;
}

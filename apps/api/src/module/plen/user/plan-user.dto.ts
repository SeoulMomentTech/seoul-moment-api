import { PlanUserRoomEntity } from '@app/repository/entity/plan-user-room.entity';
import { PlanUserEntity } from '@app/repository/entity/plan-user.entity';
import { PlanUserRoomMemberPermission } from '@app/repository/enum/plan-user-room-member.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import { IsDefined, IsNumber, IsOptional, IsString } from 'class-validator';

export class GetPlanUserResponse {
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

  static from(
    entity: PlanUserEntity,
    members: GetPlanUserRoomMemberResponse[] = [],
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

export class PostPlanUserRoomResponse {
  @ApiProperty({
    description: '방 공유 코드',
    example: '1234567890',
  })
  shareCode: string;

  static from(entity: PlanUserRoomEntity) {
    return plainToInstance(this, {
      shareCode: entity.shareCode,
    });
  }
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

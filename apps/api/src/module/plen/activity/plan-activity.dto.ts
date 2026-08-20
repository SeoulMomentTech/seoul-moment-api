import { PlanActivityEntity } from '@app/repository/entity/plan-activity.entity';
import {
  PlanActivityTargetType,
  PlanActivityType,
} from '@app/repository/enum/plan-activity.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';

import { ListFilterDto } from '../../admin/admin.dto';

export class GetPlanActivityListRequest extends ListFilterDto {
  @ApiPropertyOptional({
    description: '공유 방 id. 없으면 개인 플랜의 기록을 준다',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  roomId?: number;
}

export class GetPlanActivityResponse {
  @ApiProperty({ description: '활동 id', example: 42 })
  id: number;

  @ApiProperty({
    description: '활동 종류',
    example: PlanActivityType.SCHEDULE_CREATED,
    enum: PlanActivityType,
  })
  type: PlanActivityType;

  @ApiProperty({
    description: '이 일을 한 사람의 id',
    example: 'e2a394df-8eff-468d-b370-41b7c03b0587',
  })
  actorPlanUserId: string;

  @ApiProperty({ description: '이 일을 한 사람의 이름', example: '김지수' })
  actorName: string;

  @ApiPropertyOptional({
    description: '이 일을 한 사람의 프로필 이미지',
    example: 'https://image.seoulmoment.com.tw/profile/abc.png',
  })
  actorImage: string | null;

  @ApiPropertyOptional({
    description: '대상 종류',
    example: PlanActivityTargetType.SCHEDULE,
    enum: PlanActivityTargetType,
  })
  targetType: PlanActivityTargetType | null;

  @ApiPropertyOptional({ description: '대상 id', example: 17 })
  targetId: number | null;

  @ApiPropertyOptional({
    description: '대상 이름 (기록 시점 값)',
    example: '아모레 스튜디오 본식 촬영',
  })
  targetTitle: string | null;

  @ApiPropertyOptional({
    description: '금액 (만원 단위)',
    example: 185,
  })
  amount: number | null;

  @ApiProperty({
    description: '기록 시각',
    example: '2026-08-20T09:41:00.000Z',
  })
  createDate: Date;

  /**
   * 문장은 앱에서 조립한다. 서버가 완성된 문구를 내려보내면 문구를 고칠 때마다
   * 백엔드 배포에 묶인다.
   */
  static from(entity: PlanActivityEntity): GetPlanActivityResponse {
    const response = new GetPlanActivityResponse();
    response.id = entity.id;
    response.type = entity.type;
    response.actorPlanUserId = entity.planUserId;
    response.actorName = entity.planUser?.name ?? '';
    response.actorImage = entity.planUser?.getProfileImageUrl?.() ?? null;
    response.targetType = entity.targetType;
    response.targetId = entity.targetId;
    response.targetTitle = entity.targetTitle;
    response.amount = entity.amount;
    response.createDate = entity.createDate;
    return response;
  }
}

import { PlanUserEntity } from '@app/repository/entity/plan-user.entity';
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

  static from(entity: PlanUserEntity) {
    return plainToInstance(this, {
      id: entity.id,
      weddingDate: entity.weddingDate,
      budget: entity.budget,
      name: entity.name,
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

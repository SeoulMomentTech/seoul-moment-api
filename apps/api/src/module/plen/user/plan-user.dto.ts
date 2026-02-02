import { PlanUserEntity } from '@app/repository/entity/plan-user.entity';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import { IsDefined, IsNumber, IsString } from 'class-validator';

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

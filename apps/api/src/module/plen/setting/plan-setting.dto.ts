import { PlanUserEntity } from '@app/repository/entity/plan-user.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import { IsString, IsDefined, IsNumber, IsOptional } from 'class-validator';

export class PostPlanSettingRequest {
  @ApiPropertyOptional({
    description: '웨딩 날짜',
    example: '2025-02-24',
  })
  @IsString()
  @IsOptional()
  weddingDate?: string;

  @ApiPropertyOptional({
    description: '예산 (만원 단위)',
    example: 10000,
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  budget?: number;

  @ApiPropertyOptional({
    description: '이름/닉네임',
    example: '세리프',
  })
  @IsString()
  @IsOptional()
  name?: string;
}

export class PostPlanSettingResponse {
  @ApiProperty({
    description: 'UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsDefined()
  id: string;

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
  @Type(() => Number)
  @IsDefined()
  budget: number;

  @ApiProperty({
    description: '이름/닉네임',
    example: '세리프',
  })
  @IsString()
  @IsDefined()
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

import { PlanAllCategoryDto } from '@app/repository/dto/plan-category.dto';
import { PlanCategoryType } from '@app/repository/enum/plan-category.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class GetPlanCategoryResponse {
  @ApiProperty({
    description: 'ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '이름',
    example: '저녁 식사',
  })
  name: string;

  @ApiProperty({
    description: '색상',
    example: '#8E9DAB',
  })
  color: string;

  @ApiProperty({
    description: '타입',
    example: PlanCategoryType.SYSTEM,
    enum: PlanCategoryType,
  })
  type: PlanCategoryType;

  static from(entity: PlanAllCategoryDto) {
    return plainToInstance(this, {
      id: entity.id,
      name: entity.name,
      color: entity.color,
      type: entity.type,
    });
  }
}

export class GetPlanCategoryListRequest {
  @ApiPropertyOptional({
    description: '사용자 아이디',
    example: '1',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}

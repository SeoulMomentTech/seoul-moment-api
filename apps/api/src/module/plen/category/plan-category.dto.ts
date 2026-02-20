import { PlanAllCategoryDto } from '@app/repository/dto/plan-category.dto';
import { PlanCategoryType } from '@app/repository/enum/plan-category.enum';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

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
    description: '타입',
    example: PlanCategoryType.SYSTEM,
    enum: PlanCategoryType,
  })
  type: PlanCategoryType;

  static from(entity: PlanAllCategoryDto) {
    return plainToInstance(this, {
      id: entity.id,
      name: entity.name,
      type: entity.type,
    });
  }
}

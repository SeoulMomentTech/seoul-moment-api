import { PlanAllCategoryDto } from '@app/repository/dto/plan-category.dto';
import { PlanCategoryType } from '@app/repository/enum/plan-category.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiPropertyOptional({
    description:
      '만든 사람 이름. 방에서 공유된 카테고리(ROOM)에만 있다 — ' +
      '시스템 기본에는 만든 사람이 없고, 내가 만든 것은 화면이 이미 ' +
      "'my' 로 말한다.",
    example: '민지',
  })
  createdByName?: string;

  static from(entity: PlanAllCategoryDto) {
    return plainToInstance(this, {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      createdByName: entity.createdByName,
    });
  }
}

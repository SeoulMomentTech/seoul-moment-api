import { CategoryEntity } from '@app/repository/entity/category.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

import { MultilingualFieldDto } from '../dto/multilingual.dto';

export class GetCategoryResponse {
  @ApiProperty({
    description: 'Category ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Category name in requested language',
    example: '패션',
  })
  name: string;

  static from(
    entity: CategoryEntity,
    multilingualText: MultilingualTextEntity[],
  ) {
    multilingualText = multilingualText.filter((v) => v.entityId === entity.id);

    const name = MultilingualFieldDto.fromByEntity(multilingualText, 'name');

    return plainToInstance(this, {
      id: entity.id,
      name: name.getContent(),
    });
  }
}

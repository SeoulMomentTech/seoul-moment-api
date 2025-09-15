import { CategoryEntity } from '@app/repository/entity/category.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsInt,
  IsString,
  ValidateNested,
} from 'class-validator';

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

export class PostCategoryInfo {
  @ApiProperty({ description: '언어 ID' })
  @IsInt()
  @IsDefined()
  languageId: number;

  @ApiProperty({ description: '카테고리 이름' })
  @IsString()
  @IsDefined()
  name: string;
}

export class PostCategoryRequest {
  @ApiProperty({
    description: '카테고리 국가별 object list',
    type: [PostCategoryInfo],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostCategoryInfo)
  @IsDefined()
  list: PostCategoryInfo[];
}

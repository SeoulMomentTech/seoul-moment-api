import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { OptionValueEntity } from '@app/repository/entity/option-value.entity';
import { OptionEntity } from '@app/repository/entity/option.entity';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import { IsDefined, IsNumber } from 'class-validator';

import { MultilingualFieldDto } from '../dto/multilingual.dto';

export class GetOptionResponse {
  @ApiProperty({
    description: 'option id',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '상품 옵션 타입',
    example: 'COLOR',
  })
  type: string;

  static from(entity: OptionEntity) {
    return plainToInstance(this, {
      id: entity.id,
      type: entity.type,
    });
  }
}

export class GetOptionValueRequest {
  @ApiProperty({
    description: 'option Id',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  optionId: number;
}

export class GetOptionValueResponse {
  @ApiProperty({
    description: 'option value id',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'option 값',
    example: '빨강',
  })
  value: string;

  static from(
    entity: OptionValueEntity,
    multilingual: MultilingualTextEntity[],
  ) {
    multilingual = multilingual.filter((v) => v.entityId === entity.id);

    const value = MultilingualFieldDto.fromByEntity(multilingual, 'value');

    return plainToInstance(this, {
      id: entity.id,
      value: value.getContent(),
    });
  }
}

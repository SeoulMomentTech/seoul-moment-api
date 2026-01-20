import { DatabaseSort } from '@app/common/enum/global.enum';
import { RequireKey } from '@app/common/type/require-key.type';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

import { OptionValueEntity } from '../entity/option-value.entity';
import { OptionEntity } from '../entity/option.entity';
import { OptionSortColumn } from '../enum/option.repository.enum';

export type UpdateOptionDto = RequireKey<OptionEntity, 'id'>;
export type UpdateOptionValueDto = RequireKey<OptionValueEntity, 'id'>;
export class OptionSortDto {
  @ApiProperty({
    description: '정렬할 컬럼',
    enum: OptionSortColumn,
    example: OptionSortColumn.CREATE,
  })
  sortColumn: OptionSortColumn;

  @ApiProperty({
    description: '정렬 방향',
    enum: DatabaseSort,
    example: DatabaseSort.DESC,
  })
  sort: DatabaseSort;

  static from(sortColumn: OptionSortColumn, sort: DatabaseSort): OptionSortDto {
    return plainToInstance(this, { sortColumn, sort });
  }
}

export class OptionValueDto {
  @ApiProperty({
    description: '옵션 값 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '옵션 값',
    example: 'Red',
  })
  value: string;

  static from(id: number, value: string) {
    return plainToInstance(this, { id, value });
  }
}

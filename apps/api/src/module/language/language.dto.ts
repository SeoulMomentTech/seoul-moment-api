import { LanguageEntity } from '@app/repository/entity/language.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

export class GetAvaliableLanguageResponse {
  @ApiProperty({ description: '언어 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '언어명', example: '한국어' })
  name: string;

  @ApiProperty({ description: '정렬 순서', example: 1 })
  sortOrder: number;

  @ApiProperty({ description: '언어 코드', example: 'ko', enum: LanguageCode })
  code: LanguageCode;

  static from(entity: LanguageEntity) {
    return plainToInstance(this, {
      id: entity.id,
      name: entity.name,
      sortOrder: entity.sortOrder,
      code: entity.code,
    });
  }
}

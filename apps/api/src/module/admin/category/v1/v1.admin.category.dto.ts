import { CategoryEntity } from '@app/repository/entity/category.entity';
import { MultilingualTextEntity } from '@app/repository/entity/multilingual-text.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import { IsArray, IsDefined, IsNumber, ValidateNested } from 'class-validator';

import { AdminCategoryLanguageDto } from '../admin.category.dto';

export class V1GetAdminCategoryResponse {
  @ApiProperty({
    description: '카테고리 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '카테고리 이름 리스트',
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        name: '뷰티',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        name: 'Fashion',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        name: '時尚',
      },
    ],
    type: [AdminCategoryLanguageDto],
  })
  languageList: AdminCategoryLanguageDto[];

  @ApiProperty({
    description: '생성일',
    example: '2025-01-01T12:00:00.000Z',
  })
  createDate: Date;

  @ApiProperty({
    description: '수정일',
    example: '2025-01-01T12:00:00.000Z',
  })
  updateDate: Date;

  static from(
    entity: CategoryEntity,
    multilingualText: MultilingualTextEntity[],
  ) {
    const multilingualTextList = multilingualText.filter(
      (v) => v.entityId === entity.id && v.fieldName === 'name',
    );

    const languageList = multilingualTextList.map((v) =>
      plainToInstance(AdminCategoryLanguageDto, {
        languageCode: v.language.code,
        name: v.textContent,
      }),
    );

    return plainToInstance(this, {
      id: entity.id,
      languageList,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

export class V1UpdateAdminCategoryRequest {
  @ApiProperty({
    description: '카테고리 국가별 object list',
    type: [AdminCategoryLanguageDto],
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        name: '뷰티',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        name: 'Fashion',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        name: '時尚',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminCategoryLanguageDto)
  @IsDefined()
  languageList: AdminCategoryLanguageDto[];

  @ApiProperty({
    description: '정렬 순서',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  sortOrder: number;
}

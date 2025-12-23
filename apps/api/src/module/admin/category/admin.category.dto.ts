import { CategoryEntity } from '@app/repository/entity/category.entity';
import { CategorySearchEnum } from '@app/repository/enum/category.repository.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { ListFilterDto } from '../admin.dto';

export class AdminCategoryListRequest extends ListFilterDto {
  @ApiPropertyOptional({
    description: '검색 칼럼',
    example: CategorySearchEnum.NAME,
    enum: CategorySearchEnum,
  })
  @IsOptional()
  @IsEnum(CategorySearchEnum)
  searchColumn: CategorySearchEnum;
}

export class GetAdminCategoryNameDto {
  @ApiProperty({
    description: '언어 코드',
    example: LanguageCode.KOREAN,
  })
  languageCode: LanguageCode;

  @ApiProperty({
    description: '카테고리 이름',
    example: '뷰티',
  })
  name: string;

  static from(languageCode: LanguageCode, name: string) {
    return plainToInstance(this, {
      languageCode,
      name,
    });
  }
}

export class GetAdminCategoryResponse {
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
    type: [GetAdminCategoryNameDto],
  })
  nameDto: GetAdminCategoryNameDto[];

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

  static from(entity: CategoryEntity, nameDto: GetAdminCategoryNameDto[]) {
    return plainToInstance(this, {
      id: entity.id,
      nameDto,
      createDate: entity.createDate,
      updateDate: entity.updateDate,
    });
  }
}

export class AdminCategoryTextInfo {
  @ApiProperty({
    description: '언어 ID',
    example: 1,
  })
  @IsInt()
  @IsDefined()
  languageId: number;

  @ApiProperty({
    description: '카테고리 이름',
    example: '패션',
  })
  @IsString()
  @IsDefined()
  name: string;
}

export class PostAdminCategoryRequest {
  @ApiProperty({
    description: '카테고리 국가별 object list',
    type: [AdminCategoryTextInfo],
    example: [
      {
        languageId: 1,
        name: '패션',
      },
      {
        languageId: 2,
        name: 'Fashion',
      },
      {
        languageId: 3,
        name: '时尚',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminCategoryTextInfo)
  @IsDefined()
  list: AdminCategoryTextInfo[];
}

export class UpdateAdminCategoryRequest {
  @ApiPropertyOptional({
    description: '카테고리 국가별 object list',
    type: [AdminCategoryTextInfo],
    example: [
      {
        languageId: 1,
        name: '패션',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminCategoryTextInfo)
  @IsOptional()
  list: AdminCategoryTextInfo[];

  @ApiPropertyOptional({
    description: '정렬 순서',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  sortOrder: number;
}

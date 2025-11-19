import { DatabaseSort } from '@app/common/enum/global.enum';
import { CategoryEntity } from '@app/repository/entity/category.entity';
import { CategorySearchEnum } from '@app/repository/enum/category.repository.enum';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class ListFilterDto {
  @ApiPropertyOptional({
    description: '페이지 번호',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: '페이지 크기',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pageSize?: number = 10;

  @ApiPropertyOptional({
    description: '검색',
    example: '검색',
  })
  @IsOptional()
  @IsString()
  searchName?: string;

  @ApiPropertyOptional({
    description: '정렬 방식',
    example: DatabaseSort.DESC,
    enum: DatabaseSort,
  })
  @IsOptional()
  @IsEnum(DatabaseSort)
  sort: DatabaseSort = DatabaseSort.DESC;
}

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

export class GetAdminCategoryListResponse {
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

  static from(entity: CategoryEntity, nameDto: GetAdminCategoryNameDto[]) {
    return plainToInstance(this, {
      id: entity.id,
      nameDto,
    });
  }
}

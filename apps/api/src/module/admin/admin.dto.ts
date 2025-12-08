import { DatabaseSort } from '@app/common/enum/global.enum';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
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
  count?: number = 10;

  @ApiPropertyOptional({
    description: '검색',
    example: '검색',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: '정렬 방식',
    example: DatabaseSort.DESC,
    enum: DatabaseSort,
    default: DatabaseSort.DESC,
  })
  @IsOptional()
  @IsEnum(DatabaseSort)
  sort: DatabaseSort = DatabaseSort.DESC;
}

export class ListSimpleFilterDto {
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
  count?: number = 10;

  @ApiPropertyOptional({
    description: '정렬 방식',
    example: DatabaseSort.DESC,
    enum: DatabaseSort,
    default: DatabaseSort.DESC,
  })
  @IsOptional()
  @IsEnum(DatabaseSort)
  sort: DatabaseSort = DatabaseSort.DESC;
}

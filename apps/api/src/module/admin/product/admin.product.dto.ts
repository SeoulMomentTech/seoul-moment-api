import { ProductEntity } from '@app/repository/entity/product.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ProductSortColumn } from '@app/repository/enum/product.enum';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import { IsArray, IsDefined, IsEnum, ValidateNested } from 'class-validator';

import { ListFilterDto } from '../admin.dto';

export class GetAdminProductRequest extends ListFilterDto {
  @ApiProperty({
    description: '정렬 컬럼',
    enum: ProductSortColumn,
    example: ProductSortColumn.CREATE,
  })
  @IsEnum(ProductSortColumn)
  @IsDefined()
  sortColumn: ProductSortColumn;
}

export class GetAdminProductNameDto {
  @ApiProperty({
    description: '언어 코드',
    example: LanguageCode.KOREAN,
  })
  languageCode: LanguageCode;

  @ApiProperty({
    description: '상품 이름',
    example: '나이키 드라이핏 티셔츠',
  })
  name: string;

  static from(languageCode: LanguageCode, name: string) {
    return plainToInstance(this, {
      languageCode,
      name,
    });
  }
}

export class GetAdminProductResponse {
  @ApiProperty({
    description: '상품 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '상품 이름 리스트',
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        name: '나이키 드라이핏 티셔츠',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        name: 'Nike Dry-Fit T-Shirt',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        name: '耐吉乾爽T恤',
      },
    ],
    type: [GetAdminProductNameDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminProductNameDto)
  nameDto: GetAdminProductNameDto[];

  static from(entity: ProductEntity, nameDto: GetAdminProductNameDto[]) {
    return plainToInstance(this, {
      id: entity.id,
      nameDto,
    });
  }
}

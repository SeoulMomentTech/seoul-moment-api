import { ProductCategoryEntity } from '@app/repository/entity/product-category.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';

import { ListFilterDto } from '../../admin.dto';

export class GetAdminProductCategoryRequest extends ListFilterDto {}

export class GetAdminProductCategoryNameDto {
  @ApiProperty({
    description: '언어 코드',
    example: LanguageCode.KOREAN,
  })
  languageCode: LanguageCode;

  @ApiProperty({
    description: '상품 카테고리 이름',
    example: '아우터',
  })
  name: string;

  static from(languageCode: LanguageCode, name: string) {
    return plainToInstance(this, {
      languageCode,
      name,
    });
  }
}

export class PostAdminProductCategoryNameDto {
  @ApiProperty({
    description: '언어 ID',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  languageId: number;

  @ApiProperty({
    description: '상품 카테고리 이름',
    example: '아우터',
  })
  @IsString()
  @IsDefined()
  name: string;
}

export class GetAdminProductCategoryResponse {
  @ApiProperty({
    description: '상품 카테고리 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '상품 카테고리 이미지 URL',
    example: 'https://image-dev.seoulmoment.com.tw/product-category/1.png',
  })
  imageUrl: string;

  @ApiProperty({
    description: '상품 카테고리 이름 리스트',
    example: [
      {
        languageCode: LanguageCode.KOREAN,
        name: '아우터',
      },
      {
        languageCode: LanguageCode.ENGLISH,
        name: 'Outer',
      },
      {
        languageCode: LanguageCode.TAIWAN,
        name: '外套',
      },
    ],
    type: [GetAdminProductCategoryNameDto],
  })
  nameDto: GetAdminProductCategoryNameDto[];

  static from(
    entity: ProductCategoryEntity,
    nameDto: GetAdminProductCategoryNameDto[],
  ) {
    return plainToInstance(this, {
      id: entity.id,
      nameDto,
    });
  }
}

export class PostAdminProductCategoryRequest {
  @ApiProperty({
    description: '카테고리 국가별 object list',
    type: [PostAdminProductCategoryNameDto],
    example: [
      {
        languageId: 1,
        name: '귀걸이',
      },
      {
        languageId: 2,
        name: 'Earrings',
      },
      {
        languageId: 3,
        name: '耳環',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminProductCategoryNameDto)
  @IsDefined()
  list: PostAdminProductCategoryNameDto[];

  @ApiProperty({
    description: '카테고리 아이디',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  categoryId: number;

  @ApiProperty({
    description: '카테고리 이미지 URL',
    example: 'https://example.com/image1.jpg',
  })
  @IsString()
  @IsDefined()
  imageUrl: string;
}

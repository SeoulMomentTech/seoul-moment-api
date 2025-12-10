import { ProductCategoryEntity } from '@app/repository/entity/product-category.entity';
import { LanguageCode } from '@app/repository/enum/language.enum';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

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

import { ProductItemEntity } from '@app/repository/entity/product-item.entity';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { IsDefined, IsInt, IsNumber, IsString } from 'class-validator';

import { ListFilterDto } from '../../admin.dto';

export class GetAdminProductItemRequest extends ListFilterDto {}

export class GetAdminProductItemResponse {
  @ApiProperty({
    description: '상품 아이템 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '상품 ID',
    example: 1,
  })
  @IsInt()
  @IsDefined()
  productId: number;

  @ApiProperty({
    description: '이미지 URL',
    example: 'https://image-dev.seoulmoment.com.tw/product/product_item_1.jpg',
  })
  @IsString()
  @IsDefined()
  imageUrl: string;

  @ApiProperty({
    description: '색상 코드',
    example: '#000000',
  })
  @IsString()
  @IsDefined()
  colorCode: string;

  @ApiProperty({
    description: '가격',
    example: 10000,
  })
  @IsNumber()
  @IsDefined()
  price: number;

  @ApiProperty({
    description: '할인 가격',
    example: 10000,
  })
  @IsNumber()
  @IsDefined()
  discountPrice: number;

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

  static from(entity: ProductItemEntity) {
    return plainToInstance(this, {
      id: entity.id,
      productId: entity.productId,
      imageUrl: entity.getMainImage(),
      colorCode:
        entity.variants.flatMap((v) =>
          v.variantOptions
            .filter((v) => v.optionValue.option.type === 'COLOR')
            .map((v) => v.optionValue.colorCode),
        )[0] || null,
      price: entity.price,
      discountPrice: entity.discountPrice,
    });
  }
}

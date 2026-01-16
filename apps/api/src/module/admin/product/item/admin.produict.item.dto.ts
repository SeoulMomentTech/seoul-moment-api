import { ProductItemEntity } from '@app/repository/entity/product-item.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

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

export class PostAdminProductVariantRequest {
  @ApiProperty({
    description: 'SKU',
    example: 'NK-TS-RED-M',
  })
  @IsString()
  @IsDefined()
  sku: string;

  @ApiProperty({
    description: '재고 수량',
    example: 50,
  })
  @IsNumber()
  @Type(() => Number)
  @IsDefined()
  stockQuantity: number;

  @ApiProperty({
    description: '옵션 값 ID 목록',
    example: [1, 5],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @IsDefined()
  optionValueIdList: number[];
}
export class PostAdminProductItemRequest {
  @ApiProperty({
    description: '상품 ID',
    example: 11,
  })
  @IsNumber()
  @IsDefined()
  productId: number;

  @ApiProperty({
    description: '목록 페이지용 대표 이미지 URL',
    example: 'https://example.com/main-image.jpg',
  })
  @IsString()
  @IsDefined()
  mainImageUrl: string;

  @ApiProperty({
    description: '가격',
    example: 29900,
  })
  @IsNumber()
  @IsDefined()
  price: number;

  @ApiPropertyOptional({
    description: '할인 가격',
    example: 24900,
  })
  @IsNumber()
  @IsOptional()
  discountPrice?: number;

  @ApiProperty({
    description: '배송비용',
    example: 2500,
  })
  @IsNumber()
  @IsDefined()
  shippingCost: number;

  @ApiProperty({
    description: '배송출고 일자',
    example: 3,
  })
  @IsNumber()
  @IsDefined()
  shippingInfo: number;

  @ApiPropertyOptional({
    description: '이미지 URL 목록',
    example: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
      'https://example.com/image3.jpg',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  imageUrlList?: string[];

  @ApiProperty({
    description: '상품 변형 목록',
    example: [
      {
        sku: 'NK-TS-RED-M',
        stockQuantity: 50,
        optionValueIdList: [1, 5],
      },
      {
        sku: 'NK-TS-RED-L',
        stockQuantity: 30,
        optionValueIdList: [1, 6],
      },
      {
        sku: 'NK-TS-BLUE-M',
        stockQuantity: 45,
        optionValueIdList: [2, 5],
      },
      {
        sku: 'NK-TS-BLUE-L',
        stockQuantity: 25,
        optionValueIdList: [2, 6],
      },
      {
        sku: 'NK-TS-GREEN-M',
        stockQuantity: 20,
        optionValueIdList: [3, 5],
      },
      {
        sku: 'NK-TS-GREEN-L',
        stockQuantity: 15,
        optionValueIdList: [3, 6],
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminProductVariantRequest)
  @IsDefined()
  variantList: PostAdminProductVariantRequest[];
}

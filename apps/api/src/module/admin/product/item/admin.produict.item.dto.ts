import { OptionValueDto } from '@app/repository/dto/option.dto';
import { ProductItemEntity } from '@app/repository/entity/product-item.entity';
import { ProductVariantEntity } from '@app/repository/entity/product-variant.entity';
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

export class GetAdminProductOptionValueResponse {
  @ApiProperty({
    description: '옵션 값 ID',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '옵션 값',
    example: 'Red',
  })
  @IsString()
  @IsDefined()
  value: string;
}

export class GetAdminProductVariantResponse {
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
    example: [
      {
        id: 1,
        value: 'Red',
      },
      {
        id: 5,
        value: 'M',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminProductOptionValueRequest)
  @IsDefined()
  optionValueList: PostAdminProductOptionValueRequest[];

  static from(entity: ProductVariantEntity, optionValueList: OptionValueDto[]) {
    const variantOptionValueIds = new Set(
      entity.variantOptions.map((vo) => vo.optionValueId),
    );
    const filteredOptionValueList = optionValueList.filter((ov) =>
      variantOptionValueIds.has(ov.id),
    );

    return plainToInstance(this, {
      sku: entity.sku,
      stockQuantity: entity.stockQuantity,
      optionValueList: filteredOptionValueList.map((v) => ({
        id: v.id,
        value: v.value,
      })),
    });
  }
}

export class GetAdminProductItemInfoResponse {
  @ApiProperty({
    description: '상품 아이템 ID',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  id: number;

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
    description: '상품 옵션 목록',
    example: [
      {
        sku: 'NK-TS-RED-M',
        stockQuantity: 50,
        optionValueList: [
          {
            id: 1,
            value: 'Red',
          },
          {
            id: 5,
            value: 'M',
          },
        ],
      },
      {
        sku: 'NK-TS-RED-L',
        stockQuantity: 30,
        optionValueList: [
          {
            id: 1,
            value: 'Red',
          },
          {
            id: 6,
            value: 'L',
          },
        ],
      },
      {
        sku: 'NK-TS-BLUE-M',
        stockQuantity: 45,
        optionValueList: [
          {
            id: 2,
            value: 'Blue',
          },
          {
            id: 5,
            value: 'M',
          },
        ],
      },
      {
        sku: 'NK-TS-BLUE-L',
        stockQuantity: 25,
        optionValueList: [
          {
            id: 2,
            value: 'Blue',
          },
          {
            id: 6,
            value: 'L',
          },
        ],
      },
      {
        sku: 'NK-TS-GREEN-M',
        stockQuantity: 20,
        optionValueList: [
          {
            id: 3,
            value: 'Green',
          },
          {
            id: 5,
            value: 'M',
          },
        ],
      },
      {
        sku: 'NK-TS-GREEN-L',
        stockQuantity: 15,
        optionValueList: [
          {
            id: 3,
            value: 'Green',
          },
          {
            id: 6,
            value: 'L',
          },
        ],
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetAdminProductVariantResponse)
  @IsDefined()
  variantList: GetAdminProductVariantResponse[];

  static from(entity: ProductItemEntity, optionValueList: OptionValueDto[]) {
    return plainToInstance(this, {
      id: entity.id,
      productId: entity.productId,
      mainImageUrl: entity.getMainImage(),
      price: entity.price,
      discountPrice: entity.discountPrice,
      shippingCost: entity.shippingCost,
      shippingInfo: entity.shippingInfo,
      imageUrlList: entity.images.map((v) => v.getImage()),
      variantList: entity.variants.map((v) =>
        GetAdminProductVariantResponse.from(v, optionValueList),
      ),
    });
  }
}

export class PostAdminProductOptionValueRequest {
  @ApiProperty({
    description: '옵션 값 ID',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '옵션 값',
    example: 'Red',
  })
  @IsString()
  @IsDefined()
  value: string;
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
    description: '상품 옵션 목록',
    example: [
      {
        sku: 'NK-TS-RED-M',
        stockQuantity: 50,
        optionValueIdList: [10, 12],
      },
      {
        sku: 'NK-TS-RED-L',
        stockQuantity: 30,
        optionValueIdList: [10, 13],
      },
      {
        sku: 'NK-TS-BLUE-M',
        stockQuantity: 45,
        optionValueIdList: [10, 14],
      },
      {
        sku: 'NK-TS-BLUE-L',
        stockQuantity: 25,
        optionValueIdList: [11, 12],
      },
      {
        sku: 'NK-TS-GREEN-M',
        stockQuantity: 20,
        optionValueIdList: [11, 13],
      },
      {
        sku: 'NK-TS-GREEN-L',
        stockQuantity: 15,
        optionValueIdList: [11, 14],
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAdminProductVariantRequest)
  @IsDefined()
  variantList: PostAdminProductVariantRequest[];
}

export class PatchAdminProductOptionValueRequest {
  @ApiPropertyOptional({
    description: '옵션 값 ID',
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  id?: number;

  @ApiPropertyOptional({
    description: '옵션 값',
    example: 'Red',
  })
  @IsString()
  @IsOptional()
  value?: string;
}

export class PatchAdminProductVariantRequest {
  @ApiPropertyOptional({
    description: 'SKU',
    example: 'NK-TS-RED-M',
  })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional({
    description: '재고 수량',
    example: 50,
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  stockQuantity?: number;

  @ApiPropertyOptional({
    description: '옵션 값 ID 목록',
    example: [1, 5],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  optionValueIdList?: number[];
}

export class PatchAdminProductItemRequest {
  @ApiPropertyOptional({
    description: '상품 ID',
    example: 11,
  })
  @IsNumber()
  @IsOptional()
  productId: number;

  @ApiPropertyOptional({
    description: '목록 페이지용 대표 이미지 URL',
    example: 'https://example.com/main-image.jpg',
  })
  @IsString()
  @IsOptional()
  mainImageUrl?: string;

  @ApiPropertyOptional({
    description: '가격',
    example: 29900,
  })
  @IsNumber()
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({
    description: '할인 가격',
    example: 24900,
  })
  @IsNumber()
  @IsOptional()
  discountPrice?: number;

  @ApiPropertyOptional({
    description: '배송비용',
    example: 2500,
  })
  @IsNumber()
  @IsOptional()
  shippingCost?: number;

  @ApiPropertyOptional({
    description: '배송출고 일자',
    example: 3,
  })
  @IsNumber()
  @IsOptional()
  shippingInfo?: number;

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

  @ApiPropertyOptional({
    description: '상품 옵션 목록',
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
  @Type(() => PatchAdminProductVariantRequest)
  @IsOptional()
  variantList: PatchAdminProductVariantRequest[];
}

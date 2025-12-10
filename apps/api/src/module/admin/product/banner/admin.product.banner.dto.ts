import { ProductBannerEntity } from '@app/repository/entity/product-banner.entity';
import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';

import { ListSimpleFilterDto } from '../../admin.dto';

export class AdminProductBannerListRequest extends ListSimpleFilterDto {}

export class AdminProductBannerListResponse {
  @ApiProperty({
    description: '배너 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '배너 이미지 URL',
    example:
      'https://image-dev.seoulmoment.com.tw/product-banners/2025-09-16/product-banner-01.jpg',
  })
  imageUrl: string;

  @ApiProperty({
    description: '배너 정렬 순서',
    example: 1,
  })
  sort: number;

  static from(entity: ProductBannerEntity) {
    return plainToInstance(this, {
      id: entity.id,
      imageUrl: entity.getImage(),
      sort: entity.sortOrder,
    });
  }
}

export class PostAdminProductBannerRequest {
  @ApiProperty({
    description: '배너 이미지 URL',
    example: '/product-banners/2025-09-16/product-banner-01.jpg',
  })
  @IsString()
  @IsDefined()
  imageUrl: string;
}

export class PatchAdminProductBannerRequest {
  @ApiProperty({
    description: '배너 이미지 URL',
    example: '/product-banners/2025-09-16/product-banner-01.jpg',
  })
  @IsString()
  @IsDefined()
  imageUrl?: string;
}

export class PatchAdminProductBannerSortOrder {
  @ApiProperty({
    description: '배너 ID',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  id: number;

  @ApiProperty({
    description: '배너 정렬 순서',
    example: 1,
  })
  @IsNumber()
  @IsDefined()
  sortOrder: number;
}

export class PatchAdminProductBannerSortOrderRequest {
  @ApiProperty({
    description: '배너 정렬 순서 리스트',
    type: [PatchAdminProductBannerSortOrder],
    example: [
      {
        id: 1,
        sortOrder: 1,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatchAdminProductBannerSortOrder)
  list: PatchAdminProductBannerSortOrder[];
}

export class GetAdminProductBannerDetailResponse {
  @ApiProperty({
    description: '배너 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '배너 이미지 URL',
    example:
      'https://image-dev.seoulmoment.com.tw/product-banners/2025-09-16/product-banner-01.jpg',
  })
  imageUrl: string;

  @ApiProperty({
    description: '배너 정렬 순서',
    example: 1,
  })
  sortOrder: number;

  static from(entity: ProductBannerEntity) {
    return plainToInstance(this, {
      id: entity.id,
      imageUrl: entity.getImage(),
      sortOrder: entity.sortOrder,
    });
  }
}
